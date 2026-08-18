import Icon from '../../components/Icon'

export default function CoursesPage() {
  return (
    <div className="dashboard-content">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Workspace</p>
          <h1 className="page-title">Courses</h1>
          <p className="page-subtitle">
            Manage the training catalog: Phase 1 general training and Phase 2 department-specific training.
          </p>
        </div>
      </div>

      <div className="empty-state">
        <div className="empty-state-icon">
          <Icon name="book" size={28} />
        </div>
        <h2 className="empty-state-title">Course catalog coming in Step 8</h2>
        <p className="empty-state-desc">
          You will be able to add courses with code, name, phase (general / department), instructor,
          and credit hours. Trainees will pull from this catalog when logging their training records.
        </p>
      </div>
    </div>
  )
}
