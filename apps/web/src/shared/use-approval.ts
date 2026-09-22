import { createElement, type ButtonHTMLAttributes, useEffect, useState } from "react";
import { z } from "zod";
import { approvalItemSchema } from "@portfolio-atlas/contracts";
import { read } from "./api";
import { useSession } from "./session";
export function useApprovalPermission(
  kind: "report" | "rebalance" | "resolution",
  id?: string,
  revision?: number,
) {
  const session = useSession(),
    [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let active = true;
    setAllowed(false);
    if (session?.mode === "configured_sessions" && session.actor?.roles.includes("approver") && id)
      void read("/governance/approvals", z.array(approvalItemSchema))
        .then((r) => {
          if (active)
            setAllowed(
              r.data.some(
                (v) => v.kind === kind && v.id === id && v.revision === revision && v.canApprove,
              ),
            );
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [session, kind, id, revision]);
  return session?.mode === "local_owner" || allowed;
}

export function ApprovalButton({
  kind,
  resourceId,
  revision,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  kind: "report" | "rebalance" | "resolution";
  resourceId: string;
  revision: number;
}) {
  const allowed = useApprovalPermission(kind, resourceId, revision);
  return createElement("button", { ...props, disabled: disabled || !allowed });
}
