import { useAppDispatch } from '../store/hooks';
import { UIActions } from '../store/ui/ui.reducers';

export const useToast = () => {
  const dispatch = useAppDispatch();

  return {
    showErrorToast: (message: string) =>
      dispatch(UIActions.showToast({ message, type: 'error' })),
    showLoadingToast: (message: string) =>
      dispatch(UIActions.showToast({ message, type: 'loading' })),
    showSuccessToast: (message: string) =>
      dispatch(UIActions.showToast({ message, type: 'success' })),
    showToast: (message: string) => dispatch(UIActions.showToast({ message })),
  };
};
