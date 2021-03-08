from .base import BaseHandler

class DebugHandler(BaseHandler):
    _target = "N/A"

    def __init__(self):
        self.workers = 1
        super().__init__()

    @property
    def _can_run(self):
        return True

    @property
    def has_connection(self):
        return True
