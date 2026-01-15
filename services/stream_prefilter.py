# services/stream_prefilter.py

class StreamPreFilter:
    def __init__(
        self,
        stable_frames: int = 5,
        cooldown_frames: int = 30
    ):
        self.stable_frames = stable_frames
        self.cooldown_frames = cooldown_frames

        self._hit_count = 0
        self._cooldown = 0

    def feed(self, frame) -> bool:
        """
        傳入一張 frame
        回傳：
        True  -> 可以 freeze, 送進 invoice_flow
        False -> 繼續 stream
        """
        if self._cooldown > 0:
            self._cooldown -= 1
            return False

        if not self._basic_check(frame):
            self._reset()
            return False

        if self._looks_like_invoice(frame):
            self._hit_count += 1
        else:
            self._hit_count = 0

        if self._hit_count >= self.stable_frames:
            self._trigger()
            return True

        return False
