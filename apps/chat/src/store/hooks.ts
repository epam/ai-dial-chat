import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

import { RootState } from '@/src/types/store';

import type { AppDispatch } from './';

// Use throughout your app instead of plain useDispatch and useSelector
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
