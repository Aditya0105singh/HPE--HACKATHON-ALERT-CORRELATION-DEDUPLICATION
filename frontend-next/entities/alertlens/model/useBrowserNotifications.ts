"use client";

import { useCallback, useEffect, useState } from "react";

export type NotificationPermissionState = "unsupported" | NotificationPermission;

/**
 * Thin wrapper around the browser Notification API's permission state.
 * Deliberately never calls requestPermission() on its own - browsers require
 * that call to originate from a real user gesture (a click), and silently
 * calling it on mount is exactly the kind of unsolicited-permission-prompt
 * pattern that gets a site's future prompts auto-blocked.
 */
export function useBrowserNotifications() {
  const [permission, setPermission] = useState<NotificationPermissionState>(
    "unsupported"
  );

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  return { permission, requestPermission };
}
