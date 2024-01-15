import { render, screen } from '@testing-library/react';
import { FormEvent, useCallback, useRef, useState } from 'react';
import userEvent from '@testing-library/user-event';
import { checkValidity } from '../forms';

const formValid = 'valid';

const inputName = 'input';
const textareaName = 'textarea';
const checkboxName = 'checkbox';

const InputComponent = () => {
    const inputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const checkboxRef = useRef<HTMLInputElement>(null);

    const [isSubmitted, setIsSubmitted] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [textareaValue, setTextareaValue] = useState('');
    const [isChecked, setIsChecked] = useState(false);

    const handleSubmit = useCallback((e: FormEvent) => {
        e.preventDefault();
        const inputRefs = [
            inputRef,
            textareaRef,
            checkboxRef
        ]
        const isValid = checkValidity(inputRefs);
        if (!isValid) {
            setIsSubmitted(false);
            return;
        }
        setIsSubmitted(true);
    }, []);

    return (
        <div>
            {isSubmitted && <div>{formValid}</div>}
            <form
                role='dialog'
                onSubmit={handleSubmit}
            >
                <label htmlFor="input-id">
                    <span>{inputName}</span>
                    <input
                        value={inputValue}
                        onChange={(e) => { setInputValue(e.currentTarget.value) }}
                        id='input-id'
                        name={inputName}
                        ref={inputRef}
                        required />
                </label>
                <label htmlFor="textatea-id">
                    <span>{textareaName}</span>
                    <textarea
                        value={textareaValue}
                        onChange={(e) => { setTextareaValue(e.currentTarget.value) }}
                        id='textatea-id'
                        name={textareaName}
                        ref={textareaRef}
                        required />
                </label>
                <label htmlFor="checkbox-id">
                    <span>{checkboxName}</span>
                    <input
                        checked={isChecked}
                        onChange={(e) => { setIsChecked(e.currentTarget.checked) }}
                        id='checkbox-id'
                        type='checkbox'
                        name={checkboxName}
                        ref={checkboxRef}
                        required />
                </label>
                <button type='submit'>Submit</button>
            </form>

        </div>
    );
};

describe('Forms utils', () => {
    describe('checkValidity', () => {
        const buttonText = /submit/i;
        it('should submit the form when all inputs are valid', async () => {
            render(<InputComponent />);
            const { getByText, getByLabelText } = screen;
            const input = getByLabelText(inputName);
            const textarea = getByLabelText(textareaName);
            const checkbox = getByLabelText(checkboxName);
            const submitButton = getByText(buttonText);

            await userEvent.type(input, 'value 1');
            await userEvent.type(textarea, 'value 2');
            await userEvent.click(checkbox);

            await userEvent.click(submitButton);

            const validationMessageElement = getByText(formValid);

            expect(validationMessageElement).toBeInTheDocument();
        });

        it('should not submit the form when one or more required inputs are empty', async () => {
            render(<InputComponent />);
            const { getByText, getByLabelText, queryByText } = screen;

            const input = getByLabelText(inputName);
            const textarea = getByLabelText(textareaName);
            const submitButton = getByText(buttonText);

            await userEvent.type(input, 'value 1');

            await userEvent.click(submitButton);

            const validationMessageElement = queryByText(formValid);

            expect(validationMessageElement).not.toBeInTheDocument();

        });
    })
})
