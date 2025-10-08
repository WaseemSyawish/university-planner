import { render, screen } from '@testing-library/react';
import UniversityPlanner from '../../pages/index';

test('renders header', () => {
  render(<UniversityPlanner initialEvents={[]} initialCourses={[]} />);
  expect(screen.getByText(/University Planner/i)).toBeInTheDocument();
});
