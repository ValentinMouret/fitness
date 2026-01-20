import { TextField } from "@radix-ui/themes";
import type { ComponentProps, ChangeEvent } from "react";

type TextFieldRootProps = ComponentProps<typeof TextField.Root>;

interface NumberInputProps extends Omit<TextFieldRootProps, "type"> {
  readonly allowDecimals?: boolean;
}

function normalizeDecimalSeparator(value: string): string {
  return value.replace(",", ".");
}

export function NumberInput({
  allowDecimals = true,
  onChange,
  ...props
}: NumberInputProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.target.value = normalizeDecimalSeparator(e.target.value);
    onChange?.(e);
  };

  return (
    <TextField.Root
      type="text"
      inputMode={allowDecimals ? "decimal" : "numeric"}
      onChange={handleChange}
      {...props}
    />
  );
}
