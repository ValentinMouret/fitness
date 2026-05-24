import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router";

import { authClient } from "~/auth";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const signUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(undefined);

    await authClient.signUp.email(
      {
        email,
        password,
        name,
      },
      {
        onSuccess: () => {
          navigate("/habits");
        },

        onError: (ctx) => {
          setError(ctx.error.message);
        },
      },
    );
  };

  return (
    <div>
      <h2>Sign Up</h2>
      <form onSubmit={signUp}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        <button type="submit">Sign Up</button>
      </form>
      {error ? <p>{error}</p> : null}
    </div>
  );
}
