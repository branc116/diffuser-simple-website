import inspect
from typing import Union, List, Optional
import torch
import PIL
import numpy as np
from .diffusers2.src.diffusers import LMSDiscreteScheduler
from . import Args

def preprocess(image):
    # w, h = image.size
    # w, h = map(lambda x: x - x % 32, (w, h))  # resize to integer multiple of 32
    # image = image.resize((w, h), resample=PIL.Image.LANCZOS)
    image = image.astype(np.float32) / 255.0
    image = image[None].transpose(0, 3, 1, 2)
    image = torch.from_numpy(image).to(dtype=torch.float16, device="cuda")
    return 2.0 * image - 1.0

def save_latent(args, name, latents):
    latents = 1 / 0.18215 * latents
    image = args.s.vae.decode(latents.to(args.s.vae.dtype))

    image = (image / 2 + 0.5).clamp(0, 1)
    image = image.cpu().permute(0, 2, 3, 1).numpy()

    if args.output_type == "pil":
        image = args.s.numpy_to_pil(image)
        image[0].save(name)


@torch.no_grad()
def __call__(args: Args):
    if isinstance(args.prompt, str):
        batch_size = 1
    elif isinstance(args.prompt, list):
        batch_size = len(args.prompt)
    else:
        raise ValueError(f"`args.prompt` has to be of type `str` or `list` but is {type(args.prompt)}")

    if args.strength < 0 or args.strength > 1:
        raise ValueError(f"The value of args.strength should in [0.0, 1.0] but is {args.strength}")

    # set timesteps
    args.s.scheduler.set_timesteps(args.num_inference_steps)

    args.init_image = preprocess(args.init_image)

    # encode the init image into latents and scale the latents
    init_latent_dist = args.s.vae.encode(args.init_image)
    init_latents = init_latent_dist.sample()
    init_latents = 0.18215 * init_latents

    # expand init_latents for batch_size
    init_latents = torch.cat([init_latents] * batch_size)

    # get the original timestep using init_timestep
    offset = args.s.scheduler.config.get("steps_offset", 0)
    init_timestep = int(args.num_inference_steps * args.strength) + offset
    init_timestep = min(init_timestep, args.num_inference_steps)
    if isinstance(args.s.scheduler, LMSDiscreteScheduler):
        timesteps = torch.tensor(
            [args.num_inference_steps - init_timestep] * batch_size, dtype=torch.long, device=args.s.device
        )
    else:
        timesteps = args.s.scheduler.timesteps[-init_timestep]
        timesteps = torch.tensor([timesteps] * batch_size, dtype=torch.long, device=args.s.device)

    # add noise to latents using the timesteps
    noise = torch.randn(init_latents.shape, generator=args.generator, device=args.s.device)
    init_latents = args.s.scheduler.add_noise(init_latents, noise, timesteps).to(args.s.device)

    # get args.prompt text embeddings
    text_input = args.s.tokenizer(
        args.prompt,
        padding="max_length",
        max_length=args.s.tokenizer.model_max_length,
        truncation=True,
        return_tensors="pt",
    )
    text_embeddings = args.s.text_encoder(text_input.input_ids.to(args.s.device))[0]

    # here `guidance_scale` is defined analog to the guidance weight `w` of equation (2)
    # of the Imagen paper: https://arxiv.org/pdf/2205.11487.pdf . `guidance_scale = 1`
    # corresponds to doing no classifier free guidance.
    do_classifier_free_guidance = args.guidance_scale > 1.0
    # get unconditional embeddings for classifier free guidance
    if do_classifier_free_guidance:
        max_length = text_input.input_ids.shape[-1]
        uncond_input = args.s.tokenizer(
            [""] * batch_size, padding="max_length", max_length=max_length, return_tensors="pt"
        )
        uncond_embeddings = args.s.text_encoder(uncond_input.input_ids.to(args.s.device))[0]

        # For classifier free guidance, we need to do two forward passes.
        # Here we concatenate the unconditional and text embeddings into a single batch
        # to avoid doing two forward passes
        text_embeddings = torch.cat([uncond_embeddings, text_embeddings])

    # prepare extra kwargs for the scheduler step, since not all schedulers have the same signature
    # eta (η) is only used with the DDIMScheduler, it will be ignored for other schedulers.
    # eta corresponds to η in DDIM paper: https://arxiv.org/abs/2010.02502
    # and should be between [0, 1]
    accepts_eta = "eta" in set(inspect.signature(args.s.scheduler.step).parameters.keys())
    extra_step_kwargs = {}
    if accepts_eta:
        extra_step_kwargs["eta"] = args.eta

    latents = init_latents

    t_start = max(args.num_inference_steps - init_timestep + offset, 0)
    for i, t in enumerate(args.s.progress_bar(args.s.scheduler.timesteps[t_start:])):
        t_index = t_start + i
        save_latent(args, f"intermidiate/mid{i}.png", latents.clone())
        # expand the latents if we are doing classifier free guidance
        latent_model_input = torch.cat([latents] * 2) if do_classifier_free_guidance else latents

        # if we use LMSDiscreteScheduler, let's make sure latents are multiplied by sigmas
        if isinstance(args.s.scheduler, LMSDiscreteScheduler):
            sigma = args.s.scheduler.sigmas[t_index]
            # the model input needs to be scaled to match the continuous ODE formulation in K-LMS
            latent_model_input = latent_model_input / ((sigma**2 + 1) ** 0.5)
            latent_model_input = latent_model_input.to(args.s.unet.dtype)
            t = t.to(args.s.unet.dtype)

        # predict the noise residual
        noise_pred = args.s.unet(latent_model_input, t, encoder_hidden_states=text_embeddings)["sample"]

        # perform guidance
        if do_classifier_free_guidance:
            noise_pred_uncond, noise_pred_text = noise_pred.chunk(2)
            noise_pred = noise_pred_uncond + args.guidance_scale * (noise_pred_text - noise_pred_uncond)

        # compute the previous noisy sample x_t -> x_t-1
        if isinstance(args.s.scheduler, LMSDiscreteScheduler):
            latents = args.s.scheduler.step(noise_pred, t_index, latents, **extra_step_kwargs)["prev_sample"]
        else:
            latents = args.s.scheduler.step(noise_pred, t, latents, **extra_step_kwargs)["prev_sample"]

    # scale and decode the image latents with vae
    latents = 1 / 0.18215 * latents
    image = args.s.vae.decode(latents.to(args.s.vae.dtype))

    image = (image / 2 + 0.5).clamp(0, 1)
    image = image.cpu().permute(0, 2, 3, 1).numpy()

    if args.output_type == "pil":
        image = args.s.numpy_to_pil(image)

    return image