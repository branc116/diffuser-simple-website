from imp import load_source
import threading
import inotify.adapters

class DynamicHelper:
    def __init__(self, file_name, function_name, module_name):
        self.file_name = file_name
        self.function_name = function_name
        self.module_name = module_name
        self.module = load_source(self.module_name, self.file_name)
        self.function = getattr(self.module, self.function_name)
        threading.Thread(target=self.listen_for_changes).start()
    def listen_for_changes(self):
        notifier = inotify.adapters.Inotify()
        notifier.add_watch(self.file_name)
        for event in notifier.event_gen():
            if event is not None:
                (_, type_names, path, filename) = event
                if "IN_MODIFY" in type_names:
                    try:
                        self.module = load_source(self.module_name, self.file_name)
                        self.function = getattr(self.module, self.function_name)
                    except Exception as e:
                        print(e)
    def __call__(self, *args, **kwargs):
        return self.function(*args, **kwargs)

