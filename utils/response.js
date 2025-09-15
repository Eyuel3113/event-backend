const successResponse = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const errorResponse = (res, message = 'Error', statusCode = 500, errors = null) => {
  const response = {
    success: false,
    message,
  };

  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

const validationErrorResponse = (res, errors) => {
  return errorResponse(
    res,
    'Validation failed',
    422,
    errors.array().map(error => ({
      field: error.path,
      message: error.msg,
    }))
  );
};

module.exports = {
  successResponse,
  errorResponse,
  validationErrorResponse,
};