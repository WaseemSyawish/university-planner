import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ title = '', open = false, onClose = () => {}, children }) {
	const ref = useRef(null);

	useEffect(() => {
		if (!open) return;
		const prev = document.activeElement;
		// prevent background scroll when modal is open
		const origOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		// focus the dialog for accessibility
		setTimeout(() => { try { ref.current && ref.current.focus(); } catch (e) {} }, 10);
		function onKey(e) { if (e.key === 'Escape') onClose(); }
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('keydown', onKey);
			try { prev && prev.focus && prev.focus(); } catch (e) {}
			// restore body overflow
			document.body.style.overflow = origOverflow;
		};
	}, [open, onClose]);

	if (!open) return null;

	const modal = (
		<div className="modal-portal" aria-hidden={open ? 'false' : 'true'} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
			<div className="modal-overlay" />
			<div className="modal-dialog" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onMouseDown={(e) => e.stopPropagation()}>
				<div className="modal-header modal-header--creative">
					<div className="modal-brand-mark" aria-hidden>UP</div>
					<div className="modal-title-wrap">
						<h3 style={{ margin: 0 }}>{title}</h3>
						<div className="modal-sub" aria-hidden>Quick add a task — press Enter to create</div>
					</div>
					<button className="btn btn-ghost modal-close" onClick={onClose} aria-label="Close">✕</button>
				</div>
				<div className="modal-body">{children}</div>
			</div>
		</div>
	);

	if (typeof window !== 'undefined' && document.body) return createPortal(modal, document.body);
	return modal;
}
