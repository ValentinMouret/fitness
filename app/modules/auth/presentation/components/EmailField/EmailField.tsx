import { TextField } from "@radix-ui/themes";
import { useId } from "react";
import "./EmailField.css";

export function EmailField() {
  const id = useId();
  return (
    <label htmlFor={id}>
      Email
      <TextField.Root
        id={id}
        name="email"
        type="email"
        autoComplete="email"
        required
        className="auth-email-field"
      />
    </label>
  );
}
