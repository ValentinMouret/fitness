import { type LoaderFunctionArgs, redirect } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const dateParam = url.searchParams.get("date");
  const target = dateParam ? `/nutrition?date=${dateParam}` : "/nutrition";
  return redirect(target);
}
