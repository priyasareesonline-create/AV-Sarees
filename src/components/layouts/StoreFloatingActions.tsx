"use client";

import { useCallback, useState } from "react";
import { PhoneCall } from "lucide-react";
import { Icons } from "@/components/layouts/icons";
import { useStorefrontContact } from "@/providers/ShopContactProvider";
import {
  FloatingContactPicker,
  type ContactPickerMode,
} from "./FloatingContactPicker";
import { useMobileMenu } from "./MobileMenuContext";
import { useCheckoutChrome } from "@/providers/CheckoutChromeProvider";

const floatingActionButtonClass =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105 active:scale-95 touch-manipulation";

/**
 * Floating call + WhatsApp — cart stays in the navbar / mobile bottom nav.
 */
export function StoreFloatingActions() {
  const { isOpen: menuOpen } = useMobileMenu();
  const { hideStoreChrome } = useCheckoutChrome();
  const contact = useStorefrontContact();
  const [openPicker, setOpenPicker] = useState<ContactPickerMode | null>(null);

  const handlePickerChange = useCallback(
    (mode: ContactPickerMode, open: boolean) => {
      setOpenPicker(open ? mode : null);
    },
    [],
  );

  const hasPhone = contact.contacts.some(
    (person) => person.phone && person.phoneHref && person.phoneHref !== "tel:",
  );

  if (menuOpen || hideStoreChrome) return null;
  if (!hasPhone) return null;

  return (
    <>
      {openPicker ? (
        <div
          className="fixed inset-0 z-[225] bg-black/10 backdrop-blur-[1px] md:pointer-events-none md:bg-transparent md:backdrop-blur-none"
          aria-hidden
          onClick={() => setOpenPicker(null)}
        />
      ) : null}

      <div
        className="fixed right-4 z-[230] flex flex-col items-end gap-3 bottom-[calc(var(--mobile-nav-height)+var(--bottom-dock-height,0px)+1rem)] md:bottom-6"
        aria-label="Quick actions"
      >
        <FloatingContactPicker
          mode="call"
          isOpen={openPicker === "call"}
          onOpenChange={(open) => handlePickerChange("call", open)}
          triggerLabel="Call AV Sarees"
          triggerClassName={`animate-phone-glow ${floatingActionButtonClass} bg-primary text-white ring-2 ring-primary/40`}
          triggerIcon={<PhoneCall className="h-5 w-5" strokeWidth={2} />}
        />

        <FloatingContactPicker
          mode="whatsapp"
          isOpen={openPicker === "whatsapp"}
          onOpenChange={(open) => handlePickerChange("whatsapp", open)}
          triggerLabel="Chat on WhatsApp"
          triggerClassName={`animate-whatsapp-glow ${floatingActionButtonClass} bg-[#25D366] text-white ring-2 ring-[#25D366]/40`}
          triggerIcon={<Icons.whatsapp className="h-5 w-5" />}
        />
      </div>
    </>
  );
}
