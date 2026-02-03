// Ported from pocketbase/apis/api_error_aliases.go

import {
  type ApiError,
  NewApiError,
  NewBadRequestError,
  NewForbiddenError,
  NewInternalServerError,
  NewNotFoundError,
  NewTooManyRequestsError,
  NewUnauthorizedError,
  ToApiError,
} from "../tools/router/error.ts";

export {
  NewApiError,
  NewBadRequestError,
  NewForbiddenError,
  NewInternalServerError,
  NewNotFoundError,
  NewTooManyRequestsError,
  NewUnauthorizedError,
  ToApiError,
};
export type { ApiError };
