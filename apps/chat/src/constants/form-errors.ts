export const formErrors = {
  required: 'This field is required',
  notValidUrl: 'URL is not correct',
  notValidString: (name = 'Name', maxLength = 160) =>
    `${name} should be 2 to ${maxLength} characters long and should not contain special characters`,
};
