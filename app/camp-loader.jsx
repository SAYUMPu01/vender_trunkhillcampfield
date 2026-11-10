export function CampLoader({label = 'กำลังโหลด…'}) {
  return <div className="camp-loader" role="status">
    <span className="camp-loader-icon" aria-hidden="true"><img src="/camp-logo-transparent.webp" alt="" width="58" height="37"/></span>
    <span>{label}</span>
  </div>
}
