// utils/response.js
export const createResponse = (statusCode, success, errors, data = {}) => {
    return {
      statusCode,
      success,
      errors,
      data,
    };
  };