import { TextField } from "@radix-ui/themes";
import {
  type ChangeEvent,
  type ComponentProps,
  type FocusEvent,
  forwardRef,
} from "react";

type TextFieldRootProps = ComponentProps<typeof TextField.Root>;

interface NumberInputProps extends Omit<TextFieldRootProps, "type"> {
  readonly allowDecimals?: boolean;
}

function normalizeDecimalSeparator(value: string): string {
  return value.replace(",", ".");
}

export const NumberInput = forwardRef<
  HTMLInputElement,
  NumberInputProps & { children?: React.ReactNode }
>(({ allowDecimals = true, onChange, onFocus, children, ...props }, ref) => {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.target.value = normalizeDecimalSeparator(e.target.value);
    onChange?.(e);
  };

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    e.target.select();
    onFocus?.(e);
  };

  return (
    <TextField.Root
      ref={ref}
      type="text"
      inputMode={allowDecimals ? "decimal" : "numeric"}
      onChange={handleChange}
      onFocus={handleFocus}
      {...props}
    >
      {children}
    </TextField.Root>
  );
});

NumberInput.displayName = "NumberInput";
