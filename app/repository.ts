export type ErrDatabase = "database_error";
export type ErrNotFound = "not_found";
export type ErrValidation = "validation_error";

export type ErrRepository = ErrDatabase | ErrNotFound | ErrValidation;
