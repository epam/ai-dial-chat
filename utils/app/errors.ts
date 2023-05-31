import toast from "react-hot-toast";

export async function showAPIToastError(
    response: Response,
    localizedGeneralError: string,
) {
    let toastMessage = await response.text();

    if (response.status === 504 || !toastMessage?.length) {
        toastMessage = localizedGeneralError;
    }

    toast.error(toastMessage);
}