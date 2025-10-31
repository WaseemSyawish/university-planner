import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';

export default function AddSessionModal({ open, onClose, onSave, onUpdate, onDelete, defaultCourseId, editingSession }) {
	const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
	const [time, setTime] = useState('09:00');
	const [status, setStatus] = useState('PRESENT');
	const [points, setPoints] = useState(2);
	const [colorOpen, setColorOpen] = useState(false);
	const [savingLocal, setSavingLocal] = useState(false);
	const [deletingLocal, setDeletingLocal] = useState(false);
	const modalRef = useRef(null);
	const [isDark, setIsDark] = useState(false);

	// Keep `isDark` in sync with the document root class or OS preference.
	useEffect(() => {
		if (typeof document === 'undefined') return;
		const update = () => {
			const root = document.documentElement;
			const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
			setIsDark(root.classList.contains('dark') || prefersDark);
		};

		update();

		// Observe changes to the root element's class attribute (in case dark class is toggled)
		const mo = new MutationObserver((mutations) => {
			for (const m of mutations) {
				if (m.type === 'attributes' && m.attributeName === 'class') update();
			}
		});
		mo.observe(document.documentElement, { attributes: true });

		// Also listen to OS-level changes
		let mm = null;
		if (window.matchMedia) {
			mm = window.matchMedia('(prefers-color-scheme: dark)');
			if (mm.addEventListener) mm.addEventListener('change', update);
			else if (mm.addListener) mm.addListener(update);
		}

		return () => {
			mo.disconnect();
			if (mm) {
				if (mm.removeEventListener) mm.removeEventListener('change', update);
				else if (mm.removeListener) mm.removeListener(update);
			}
		};
	}, []);

		const STATUSES = [
			{ value: 'PRESENT', label: 'Present', hex: '#10B981', class: 'bg-status-present', darkClass: 'dark:bg-status-present' },
			{ value: 'ABSENT', label: 'Absent', hex: '#EF4444', class: 'bg-status-absent', darkClass: 'dark:bg-status-absent' },
			{ value: 'LATE', label: 'Late', hex: '#F97316', class: 'bg-status-late', darkClass: 'dark:bg-status-late' },
			{ value: 'EXCUSED', label: 'Excused', hex: '#F59E0B', class: 'bg-status-excused', darkClass: 'dark:bg-status-excused' },
			{ value: 'HOLIDAY', label: 'Holiday', hex: '#3B82F6', class: 'bg-status-holiday', darkClass: 'dark:bg-status-holiday' },
		];

	useEffect(() => {
		if (editingSession) {
			setDate(editingSession.date || new Date().toISOString().slice(0, 10));
			setTime(editingSession.time || '09:00');
			const s = editingSession.status || 'PRESENT';
			setStatus(s);
			setPoints(typeof editingSession.points === 'number' ? editingSession.points : getPointsForStatus(s));
		}
	}, [editingSession]);

	const getPointsForStatus = (s) => {
		switch (s) {
			case 'PRESENT': return 2;
			case 'EXCUSED':
			case 'LATE': return 1;
			default: return 0;
		}
	};

	const handleStatusChange = (value) => {
		setStatus(value);
		setPoints(getPointsForStatus(value));
		setColorOpen(false);
	};

	useEffect(() => {
		if (!open) return;
		// detect whether dark mode class is present on the root
		if (typeof document !== 'undefined') {
			setIsDark(document.documentElement.classList.contains('dark'));
		}
		const onKey = (e) => {
			if (e.key === 'Escape' && !savingLocal && !deletingLocal) onClose && onClose();
			if (e.key === 'Tab') {
				const el = modalRef.current;
				if (!el) return;
				const focusable = el.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])');
				if (!focusable || focusable.length === 0) return;
				const first = focusable[0];
				const last = focusable[focusable.length - 1];
				if (e.shiftKey) {
					if (document.activeElement === first) { e.preventDefault(); last.focus(); }
				} else {
					if (document.activeElement === last) { e.preventDefault(); first.focus(); }
				}
			}
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [open, savingLocal, deletingLocal, onClose]);

	if (!open) return null;

	const handleSave = async () => {
		try {
			setSavingLocal(true);
			if (editingSession && editingSession.id) {
				await onUpdate?.({ id: editingSession.id, date, time, status, points });
			} else {
				await onSave?.({ date, time, status, points, courseId: defaultCourseId });
			}
			onClose && onClose();
		} catch (err) {
			console.error('Save failed', err);
		} finally {
			setSavingLocal(false);
		}
	};

	const handleDelete = async () => {
		if (!editingSession || !editingSession.id) return;
		if (!window.confirm('Delete this session? This action cannot be undone.')) return;
		try {
			setDeletingLocal(true);
			await onDelete?.(editingSession.id);
			onClose && onClose();
		} catch (err) {
			console.error('Delete failed', err);
		} finally {
			setDeletingLocal(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
			<div ref={modalRef} className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-visible" onClick={(e) => e.stopPropagation()}>
				<div className="p-6">
					<div className="flex items-start justify-between mb-5">
						<div>
							<h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-0.5">{editingSession ? 'Edit Session' : 'Add Session'}</h2>
							<p className="text-xs text-gray-500">{editingSession ? 'Update session details' : 'Add a new attendance session'}</p>
						</div>
						<button type="button" onClick={onClose} className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 rounded-lg transition-colors">
							<X className="w-5 h-5" />
						</button>
					</div>

					<div className="space-y-5 mb-6">
						<div className="space-y-2">
							<label className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">Date & Time</label>
							<div className="grid grid-cols-2 gap-3">
																<input
																	type="date"
																	value={date}
																	onChange={(e) => setDate(e.target.value)}
																	className="h-10 px-3 rounded-lg border border-gray-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
																	style={isDark ? { boxShadow: '0 0 0 1px rgba(255,255,255,0.30)', borderColor: '#ffffff', outline: '2px solid rgba(255,255,255,0.80)' } : undefined}
																/>
																<input
																	type="time"
																	value={time}
																	onChange={(e) => setTime(e.target.value)}
																	className="h-10 px-3 rounded-lg border border-gray-200 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
																	style={isDark ? { boxShadow: '0 0 0 2px rgba(255,255,255,0.30)', borderColor: '#ffffff', outline: '2px solid rgba(255,255,255,0.80)' } : undefined}
																/>
							</div>
						</div>

						<div className="space-y-2">
							<label className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">Status</label>
							<div className="relative">
								<button type="button" onClick={() => setColorOpen(!colorOpen)} className={`w-full h-10 px-3 rounded-lg text-sm font-semibold text-white flex items-center justify-between gap-2 transition-all`} style={{ backgroundColor: STATUSES.find(s => s.value === status)?.hex }}>
									<span className="flex items-center gap-2">
										{(() => {
											switch(status) {
												case 'PRESENT': return <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>;
												case 'ABSENT': return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
												case 'LATE': return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
												case 'EXCUSED': return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
												case 'HOLIDAY': return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
												default: return null;
											}
										})()}
										{STATUSES.find(s => s.value === status)?.label}
									</span>
									<svg className={`w-4 h-4 transition-transform ${colorOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
								</button>

								{colorOpen && (
									<>
										<div className="fixed inset-0 z-10" onClick={() => setColorOpen(false)} />
										<div className="absolute z-20 mt-1 w-full rounded-lg shadow-2xl overflow-hidden">
											<div className="grid gap-0">
												{STATUSES.map(opt => {
													const getIcon = (value) => {
														switch(value) {
															case 'PRESENT': return <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>;
															case 'ABSENT': return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
															case 'LATE': return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
															case 'EXCUSED': return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
															case 'HOLIDAY': return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
															default: return null;
														}
													};
													return (
														<button
															key={opt.value}
															type="button"
															onClick={() => handleStatusChange(opt.value)}
															className="w-full text-left px-3 py-2.5 text-sm font-semibold flex items-center gap-3 transition-colors hover:brightness-110"
															style={{
																backgroundColor: opt.hex,
																color: '#ffffff'
															}}
														>
															{getIcon(opt.value)}
															<span className="flex-1">{opt.label}</span>
															{status === opt.value && (
																<svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
															)}
														</button>
													);
												})}
											</div>
										</div>
									</>
								)}
							</div>
						</div>

						<div className="space-y-2">
							<label className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">Points</label>
							<div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 text-sm">
								<span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{points}</span>
								<span className="text-gray-500 dark:text-gray-400">point{points !== 1 ? 's' : ''}</span>
							</div>
						</div>
					</div>

					<div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
						<button type="button" onClick={onClose} disabled={savingLocal || deletingLocal} className="px-5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 transition-all">Cancel</button>
						{editingSession && (
							<button type="button" onClick={handleDelete} disabled={savingLocal || deletingLocal} className="px-4 py-2 text-sm font-semibold text-red-700 bg-white dark:bg-gray-800 border border-red-200 dark:border-red-700 rounded-lg hover:bg-red-50 transition-all">
								{deletingLocal ? <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={14} /> Deleting...</span> : 'Delete'}
							</button>
						)}
						<button type="button" onClick={handleSave} disabled={savingLocal || deletingLocal} className="px-5 py-2 text-sm font-bold text-white rounded-lg bg-blue-500 hover:bg-blue-600 shadow-lg transition-all flex items-center gap-2">
							{savingLocal ? <Loader2 className="animate-spin" size={16} /> : (
								<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
							)}
							{editingSession ? 'Update Session' : 'Create Session'}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

