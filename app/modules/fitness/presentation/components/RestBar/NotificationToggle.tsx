import { Bell, BellOff, BellRing } from "lucide-react";
import { useNotificationPermission } from "~/notifications";

/** Lets the lifter allow rest notifications while the app is in the background. */
export function NotificationToggle() {
  const { permission, request } = useNotificationPermission();
  if (permission === "unsupported") return <span />;
  if (permission === "granted")
    return (
      <span className="rest-bar__notify">
        <BellRing size={16} aria-hidden="true" />
        Notifications on
      </span>
    );
  if (permission === "denied")
    return (
      <span className="rest-bar__notify">
        <BellOff size={16} aria-hidden="true" />
        Notifications blocked
      </span>
    );
  return (
    <button type="button" className="rest-bar__notify" onClick={request}>
      <Bell size={16} aria-hidden="true" />
      Notify me
    </button>
  );
}
