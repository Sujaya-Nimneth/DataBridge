/**
 * Accessible modal primitive, backed by the Astryx Dialog.
 *
 * Dialog supplies the behavior a plain overlay misses: native <dialog> focus
 * trap, initial focus on the title, Escape to close, focus restore on close,
 * aria-labelledby and scroll locking — the WCAG 2.2 AA "keep" the old custom
 * implementation provided. The wrapper preserves the app's { title, onClose,
 * children, footer, maxWidth } contract so all eight pages keep working while
 * their internals migrate to Astryx components.
 *
 * `purpose="form"` prevents an accidental backdrop click from discarding
 * in-progress wizard / connection-form edits.
 */

import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { Layout, LayoutContent, LayoutFooter, HStack } from '@astryxdesign/core/Layout';

export function Modal({ title, onClose, children, footer, maxWidth = '540px' }) {
  const close = () => onClose();

  return (
    <Dialog isOpen onOpenChange={(open) => !open && close()} purpose="form" width={maxWidth}>
      <Layout
        header={<DialogHeader title={title} onOpenChange={close} />}
        content={<LayoutContent>{children}</LayoutContent>}
        footer={
          footer ? (
            <LayoutFooter>
              <HStack gap={2} hAlign="end">
                {footer}
              </HStack>
            </LayoutFooter>
          ) : undefined
        }
      />
    </Dialog>
  );
}

export default Modal;
