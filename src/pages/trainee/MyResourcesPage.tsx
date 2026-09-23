import ResourcesCard from '../../components/ResourcesCard'

export default function MyResourcesPage() {
  return (
    <div className="dashboard-content">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">My MATTA Journey</p>
          <h1 className="page-title">Resources 學習資源</h1>
          <p className="page-subtitle">
            Training plans, schedules, and materials shared with you by your
            mentor and the MA Center. 由導師與 MA Center 分享的訓練計畫、課表與教材。
          </p>
        </div>
      </div>

      {/* Read-only: no traineeId → loads the current MT's own resources */}
      <ResourcesCard />
    </div>
  )
}
