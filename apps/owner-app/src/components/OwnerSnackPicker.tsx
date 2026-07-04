import React, { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import {
  SnackPicker,
  type SnackFulfillmentType,
  type SnackMenuItem,
} from "@a3/ui/components";
import { parseConvexError } from "@a3/ui/errors";

type SessionStatus = "active" | "completed" | "cancelled";
type PaymentStatus = "pending" | "paid" | "credit";

export interface OwnerSnackPickerProps {
  visible: boolean;
  clubId: Id<"clubs">;
  sessionId: Id<"sessions">;
  sessionStatus: SessionStatus;
  paymentStatus: PaymentStatus;
  currency: string;
  roleId?: Id<"staffRoles">;
  onClose: () => void;
}

export function OwnerSnackPicker({
  visible,
  clubId,
  sessionId,
  sessionStatus,
  paymentStatus,
  currency,
  roleId,
  onClose,
}: OwnerSnackPickerProps): React.JSX.Element | null {
  const [fulfillmentType, setFulfillmentType] =
    useState<SnackFulfillmentType | null>(null);

  const snackRows = useQuery(
    api.snacks.listAvailableSnacks,
    visible && fulfillmentType
      ? { clubId, fulfillmentType }
      : "skip",
  );

  const addSnacksToSession = useMutation(api.snacks.addSnacksToSession);

  const snacks: SnackMenuItem[] | undefined = useMemo(() => {
    if (!fulfillmentType) return undefined;
    if (snackRows === undefined) return undefined;
    return snackRows.map((s) => ({
      id: s._id,
      name: s.name,
      price: s.price,
    }));
  }, [fulfillmentType, snackRows]);

  const handleFulfillmentTypeChange = useCallback(
    (type: SnackFulfillmentType | null) => {
      setFulfillmentType(type);
    },
    [],
  );

  const handleClose = useCallback(() => {
    setFulfillmentType(null);
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(
    async (params: {
      fulfillmentType: SnackFulfillmentType;
      items: { snackId: string; qty: number }[];
    }) => {
      try {
        await addSnacksToSession({
          sessionId,
          fulfillmentType: params.fulfillmentType,
          items: params.items.map((item) => ({
            snackId: item.snackId as Id<"snacks">,
            qty: item.qty,
          })),
          roleId,
        });
      } catch (error) {
        throw new Error(parseConvexError(error as Error).message);
      }
    },
    [addSnacksToSession, sessionId, roleId],
  );

  if (!visible) {
    return null;
  }

  return (
    <SnackPicker
      visible
      sessionStatus={sessionStatus}
      paymentStatus={paymentStatus}
      currency={currency}
      snacks={snacks}
      onFulfillmentTypeChange={handleFulfillmentTypeChange}
      onSubmit={handleSubmit}
      onClose={handleClose}
    />
  );
}
