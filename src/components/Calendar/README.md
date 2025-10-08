Quick integration notes

1) Install runtime dependency:

   npm install date-fns

2) Wrap a page (or `_app.js`) with the provider:

   import { CalendarProvider } from '@/components/calendar/CalendarProvider'
   import MonthView from '@/components/calendar/MonthView'
   import AddEventDialog from '@/components/calendar/AddEventDialog'

   export default function Page() {
     return (
       <CalendarProvider initialEvents={[]} initialUsers={[]}>
         <div className="calendar-container">
           <AddEventDialog />
           <MonthView />
         </div>
       </CalendarProvider>
     )
   }

3) Styling: import `@/styles/calendar.css` in `_app.js` to pick up tokens.

Notes:
- This is a lightweight, self-contained subset of the full-calendar UI. It purposely avoids the shadcn/radix UI primitives and dark-mode classes so it fits your existing theme. You can progressively replace parts (dialogs, day-picker) with your own components.
