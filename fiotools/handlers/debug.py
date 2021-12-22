from .base import BaseHandler


class DebugHandler(BaseHandler):
    _target = "N/A"

    def __init__(self):
        self.workers = {
            'MyStorageclass': 10
        }
        super().__init__()

    @property
    def _can_run(self) -> bool:
        return True

    @property
    def has_connection(self) -> bool:
        return True

    def fio_valid(self, fio_job) -> bool:
        return True
