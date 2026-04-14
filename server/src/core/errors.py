class AgentError(Exception):
    """Raised when an agent call fails."""
    pass


class UpstreamError(Exception):
    """Raised when an external service (DummyJSON) fails."""
    pass


class PipelineTimeoutError(Exception):
    """Raised when the per-turn budget is exceeded."""
    pass
