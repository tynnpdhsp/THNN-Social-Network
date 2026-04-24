from fastapi import HTTPException, status


class AppException(HTTPException):
    def __init__(self, status_code: int, detail: str, error_code: str = ""):
        self.error_code = error_code
        super().__init__(status_code=status_code, detail=detail)


class NotFoundException(AppException):
    def __init__(self, detail: str = "Resource not found", error_code: str = "NOT_FOUND"):
        super().__init__(status.HTTP_404_NOT_FOUND, detail, error_code)


class BadRequestException(AppException):
    def __init__(self, detail: str = "Bad request", error_code: str = "BAD_REQUEST"):
        super().__init__(status.HTTP_400_BAD_REQUEST, detail, error_code)


class UnauthorizedException(AppException):
    def __init__(self, detail: str = "Unauthorized", error_code: str = "UNAUTHORIZED"):
        super().__init__(status.HTTP_401_UNAUTHORIZED, detail, error_code)


class ForbiddenException(AppException):
    def __init__(self, detail: str = "Forbidden", error_code: str = "FORBIDDEN"):
        super().__init__(status.HTTP_403_FORBIDDEN, detail, error_code)


class ConflictException(AppException):
    def __init__(self, detail: str = "Conflict", error_code: str = "CONFLICT"):
        super().__init__(status.HTTP_409_CONFLICT, detail, error_code)


class TooManyRequestsException(AppException):
    def __init__(self, detail: str = "Too many requests", error_code: str = "RATE_LIMITED"):
        super().__init__(status.HTTP_429_TOO_MANY_REQUESTS, detail, error_code)


class LockedAccountException(AppException):
    def __init__(self, detail: str = "Account is locked", error_code: str = "ACCOUNT_LOCKED"):
        super().__init__(status.HTTP_403_FORBIDDEN, detail, error_code)
