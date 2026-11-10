'use client'

import { useEffect, useState } from 'react'

const formats = ['image/jpeg','image/png','image/webp']
const fileKey = file => JSON.stringify([file.name,file.size,file.lastModified])

function PhotoPreview({file,onRemove}) {
  const [url,setUrl] = useState('')
  useEffect(() => {
    const preview = URL.createObjectURL(file)
    setUrl(preview)
    return () => URL.revokeObjectURL(preview)
  },[file])

  return <li className="zone-photo-preview">
    {url && <img src={url} alt={'ตัวอย่าง ' + file.name}/>}
    <div><small title={file.name}>{file.name}</small>
      <button type="button" className="button secondary" aria-label={'เอา ' + file.name + ' ออก'} onClick={onRemove}>เอาออก</button>
    </div>
  </li>
}

export function ZonePhotoUpload({zone,remaining}) {
  const [files,setFiles] = useState([])
  const [error,setError] = useState('')

  function selectPhotos(event) {
    const picked = Array.from(event.currentTarget.files)
    event.currentTarget.value = ''
    const merged = new Map(files.map(file => [fileKey(file),file]))
    for (const file of picked) merged.set(fileKey(file),file)
    if (picked.some(file => !file.size || file.size > 750 * 1024 ||
      !(formats.includes(file.type) || (!file.type && /\.(jpe?g|png|webp)$/i.test(file.name))))) {
      setError('ใช้รูป JPG, PNG หรือ WebP ขนาดไม่เกิน 750 KB ต่อรูป')
      return
    }
    if (merged.size > remaining) {
      setError('เลือกได้อีก ' + (remaining - files.length) + ' รูป กรุณาเลือกชุดใหม่หรือนำรูปที่เลือกไว้ออกก่อน')
      return
    }
    setFiles([...merged.values()])
    setError('')
  }

  function submit(event) {
    if (!files.length || files.length > remaining) {
      event.preventDefault()
      return
    }
    const upload = new DataTransfer()
    for (const file of files) upload.items.add(file)
    event.currentTarget.elements.media.files = upload.files
  }

  return <form action={'/admin/zone-media?zone=' + zone} method="post" encType="multipart/form-data"
    className="panel stack" onSubmit={submit}>
    <h2>รูปภาพ</h2>
    <input type="hidden" name="kind" value="image"/>
    <label>{files.length ? 'เลือกรูปเพิ่ม' : 'เลือกรูปได้หลายไฟล์'}
      <input name="media" type="file" accept={formats.join(',')} multiple disabled={!remaining} onChange={selectPhotos}/>
      <small>JPG, PNG หรือ WebP ไม่เกิน 750 KB ต่อรูป · โซนนี้เพิ่มได้อีก {remaining} รูป</small>
    </label>
    {error && <p className="notice error" role="alert">{error}</p>}
    {files.length > 0 && <div className="stack">
      <strong aria-live="polite">ภาพตัวอย่างก่อนอัปโหลด ({files.length} รูป)</strong>
      <ul className="zone-photo-previews">
        {files.map(file => <PhotoPreview key={fileKey(file)} file={file} onRemove={() => {
          setFiles(previous => previous.filter(item => item !== file))
          setError('')
        }}/>)}
      </ul>
    </div>}
    <button className="button" disabled={!files.length || files.length > remaining}>
      {files.length ? 'เพิ่มรูปภาพ ' + files.length + ' รูป' : 'เพิ่มรูปภาพ'}
    </button>
  </form>
}
