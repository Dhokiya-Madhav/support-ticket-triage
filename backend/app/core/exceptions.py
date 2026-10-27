class AppError(Exception):
    """Base class for domain errors; controllers map these to HTTP responses."""


class AuthenticationError(AppError):
    pass


class TooManyAttemptsError(AppError):
    pass


class NotFoundError(AppError):
    pass


class ConflictError(AppError):
    def __init__(self, message: str = "Conflict") -> None:
        super().__init__(message)
        self.message = message


class InvalidInputError(AppError):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class PermissionDeniedError(AppError):
    pass
