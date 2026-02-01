import { z } from "zod";
import { zfd } from "zod-form-data";

export const formText = <T extends z.ZodTypeAny>(schema: T) => zfd.text(schema);

export const formOptionalText = () => zfd.text(z.string().optional());

export const formBoolean = () =>
  zfd.text(z.enum(["true", "false"]).transform((value) => value === "true"));

export const formNumber = (schema: z.ZodType<number> = z.number()) =>
  zfd.numeric(schema);

export const formRepeatableText = () => zfd.repeatableOfType(zfd.text());
