import React, { useState } from "react";
import "./App.css";

const TYPE_LIST = [
  { key: "normal", label: "일반형" },
  { key: "full", label: "전면형", url: "https://smmonster.github.io/splash_p/" },
];

const GUIDE_LIST = [
  { name: "기본형 1", file: process.env.PUBLIC_URL + "/normal_1.png" },
  { name: "기본형 2", file: process.env.PUBLIC_URL + "/normal_2.png" },
  { name: "기본형 3", file: process.env.PUBLIC_URL + "/normal_3.png" },
  { name: "로고형 1", file: process.env.PUBLIC_URL + "/logo_1.png" },
  { name: "로고형 2", file: process.env.PUBLIC_URL + "/logo_2.png" },
  { name: "확장형 1", file: process.env.PUBLIC_URL + "/expand_1.png" },
  { name: "확장형 2", file: process.env.PUBLIC_URL + "/expand_2.png" },
  { name: "확장형 3", file: process.env.PUBLIC_URL + "/expand_3.png" },
  { name: "썸네일형 1", file: process.env.PUBLIC_URL + "/thumb_1.png" },
  { name: "썸네일형 2", file: process.env.PUBLIC_URL + "/thumb_2.png" }
];

const PREVIEW_W = 375;
const PREVIEW_H = 240;
const PREVIEW_MOBILE_W = 375;
const PREVIEW_MOBILE_H = 812;
const CONFIRM_IMAGE = process.env.PUBLIC_URL + "/confirm.png";

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function getOverlapErrorPercent(src1, src2, width, height) {
  function loadImg(src) {
    return new Promise(res => {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => res(img);
      img.src = src;
    });
  }
  const [img1, img2] = await Promise.all([loadImg(src1), loadImg(src2)]);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0,0,width,height);
  ctx.drawImage(img1,0,0,width,height);
  const data1 = ctx.getImageData(0,0,width,height).data;

  ctx.clearRect(0,0,width,height);
  ctx.drawImage(img2,0,0,width,height);
  const data2 = ctx.getImageData(0,0,width,height).data;

  let inter = 0, union = 0;
  for (let i = 3; i < data1.length; i += 4) {
    const a1 = data1[i];
    const a2 = data2[i];
    const has1 = a1 > 20;
    const has2 = a2 > 20;
    if (has1 && has2) inter++;
    if (has1 || has2) union++;
  }
  if (!union) return 1;
  return 1 - (inter / union);
}

const TAB_LIST = [
  { key: "basic", label: "기본가이드 검수" },
  { key: "guide", label: "여백가이드 검수" },
  { key: "preview", label: "미리보기" }
];

export default function SplashMaterialCheck() {
  const [materialType, setMaterialType] = useState("normal");
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imageInfo, setImageInfo] = useState({ w: null, h: null, size: null, type: null, isPng: false, isTransparent: false, name: "" });
  const [selectedGuideIdx, setSelectedGuideIdx] = useState(0);
  const [errorPercents, setErrorPercents] = useState([]);
  const [guideOpacity, setGuideOpacity] = useState(0.4);
  const [currentTab, setCurrentTab] = useState("basic");

  // 소재 업로드
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const type = file.type;
      const isPng = type === "image/png" || file.name.toLowerCase().endsWith(".png");
      const reader = new FileReader();
      reader.onload = async (ev) => {
        setUploadedImage(ev.target.result);

        // 이미지 정보
        const img = new window.Image();
        img.onload = async function () {
          let isTransparent = false;
          if (isPng) {
            const canvas = document.createElement("canvas");
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, img.width, img.height);
            const d = ctx.getImageData(0, 0, img.width, img.height).data;
            for (let i = 3; i < d.length; i += 4*32) {
              if (d[i] < 250) { isTransparent = true; break; }
            }
          }
          setImageInfo({
            w: img.width, h: img.height,
            size: file.size, type, isPng, isTransparent, name: file.name
          });

          // 오차율 계산: 모든 가이드와 비교
          const errorArr = [];
          for (let i = 0; i < GUIDE_LIST.length; ++i) {
            const guideSrc = "" + GUIDE_LIST[i].file;
            const error = await getOverlapErrorPercent(ev.target.result, guideSrc, PREVIEW_W, PREVIEW_H);
            errorArr.push(error);
          }
          setErrorPercents(errorArr);

          // 오차율 최소값(추천1) 자동 선택
          const minIdx = errorArr.reduce((best, curr, idx, arr) => (curr < arr[best] ? idx : best), 0);
          setSelectedGuideIdx(minIdx);
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  // 추천 1~3 뱃지
  const recommendOrder = errorPercents.length
    ? errorPercents
        .map((v, i) => ({ v, i }))
        .sort((a, b) => a.v - b.v)
        .slice(0, 3)
        .map(({ i }) => i)
    : [];

  return (
    <div className="top-tab-main-wrapper">
      {/* 최상단 가로 구분 탭 */}
      <div className="top-type-tab-row">
        {TYPE_LIST.map((type) => (
          <button
            key={type.key}
            className={`top-type-tab-btn${materialType === type.key ? " active" : ""}`}
            onClick={() => {
  if (type.key === "full" && type.url) {
    window.location.href = type.url;   // 전면형이면 외부 링크로 이동
    return;
  }
  // 일반형은 기존 로직 유지
  setMaterialType(type.key);
  setCurrentTab("basic");
  setUploadedImage(null);
  setImageInfo({ w: null, h: null, size: null, type: null, isPng: false, isTransparent: false, name: "" });
  setErrorPercents([]);
  setSelectedGuideIdx(0);
}}
            type="button"
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* 메인 컨텐츠 */}
      <div className="material-content-area">
        {materialType === "normal" && (
          <div className="multi-overlay-root">
            <div className="multi-overlay-card">
              <h1 className="multi-overlay-title">지도 스플래시 광고 '일반형' 소재 검수</h1>
              <p className="multi-overlay-desc">
                * 소재 기본 가이드 검수<br/>
                * 소재 여백 가이드 검수 (/w 가이드 일치율 확인)<br/>
                * 소재 적용화면 미리보기
              </p>

              {/* 업로드 버튼: 탭 위로 */}
              <div className="overlay-upload-area" style={{marginBottom: "22px"}}>
                <label htmlFor="img-upload" className="overlay-upload-btn">
                  <span className="upload-arrow" /> 스플래시 '일반형' 소재 업로드
                  <input
                    id="img-upload"
                    type="file"
                    accept="image/png"
                    onChange={handleFileChange}
                  />
                </label>
              </div>

              {/* 탭 헤더 */}
              <div className="tab-header-row">
                {TAB_LIST.map(tab => (
                  <button
                    key={tab.key}
                    className={`tab-header-btn${currentTab === tab.key ? " active" : ""}`}
                    onClick={() => setCurrentTab(tab.key)}
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 탭 컨텐츠 */}
              <div className="tab-content-box">
                {/* 1. 기본가이드 검수 탭 */}
                {currentTab === "basic" && uploadedImage && (
                  <div>
                    {/* 등록 이미지 미리보기 */}
                    <div
                      className="overlay-preview-zone overlay-preview-zone-wide overlay-preview-origin"
                      style={{
                        background: "#fff",
                        width: PREVIEW_W,
                        height: PREVIEW_H,
                        marginTop: "4px",
                        marginBottom: 24
                      }}>
                      <img
                        src={uploadedImage}
                        alt="등록 소재"
                        className="overlay-img overlay-img-wide"
                        style={{
                          width: PREVIEW_W,
                          height: PREVIEW_H
                        }}
                      />
                    </div>
                    {/* 기본가이드 검수 */}
                    <div className="ad-info-box-check" style={{ marginBottom: 20 }}>
                      <div className="info-check-row">
                        <span className="info-check-icon">
                          {imageInfo.w === 1125 && imageInfo.h === 732
                            ? <span className="check-green">✔</span>
                            : <span className="check-red">✖</span>}
                        </span>
                        <span className="info-check-label">사이즈</span>
                        <span className="info-check-value">
                          {imageInfo.w} x {imageInfo.h} px
                          <span className="info-check-criteria"> (가로 1125px, 세로 732px)</span>
                        </span>
                      </div>
                      <div className="info-check-row">
                        <span className="info-check-icon">
                          {imageInfo.size <= 400 * 1024
                            ? <span className="check-green">✔</span>
                            : <span className="check-red">✖</span>}
                        </span>
                        <span className="info-check-label">용량</span>
                        <span className="info-check-value">
                          {formatSize(imageInfo.size)}
                          <span className="info-check-criteria"> (400KB 이하)</span>
                        </span>
                      </div>
                      <div className="info-check-row">
                        <span className="info-check-icon">
                          {imageInfo.isPng
                            ? <span className="check-green">✔</span>
                            : <span className="check-red">✖</span>}
                        </span>
                        <span className="info-check-label">포맷</span>
                        <span className="info-check-value">
                          {imageInfo.type} {imageInfo.isPng ? "(PNG)" : ""}
                          <span className="info-check-criteria"> (PNG만 허용)</span>
                        </span>
                      </div>
                      <div className="info-check-row">
                        <span className="info-check-icon">
                          {imageInfo.isPng && imageInfo.isTransparent
                            ? <span className="check-green">✔</span>
                            : <span className="check-red">✖</span>}
                        </span>
                        <span className="info-check-label">투명</span>
                        <span className="info-check-value">
                          {imageInfo.isPng
                            ? (imageInfo.isTransparent ? "투명 있음" : "투명 아님")
                            : "-"}
                          <span className="info-check-criteria"> (반드시 투명)</span>
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. 여백가이드 검수 탭 */}
                {currentTab === "guide" && uploadedImage && (
                  <div className="guide-layout-2col">
                    {/* 좌측 오버레이 미리보기 */}
                    <div className="guide-overlay-preview-col">
                      <div
                        className="overlay-preview-zone overlay-preview-zone-wide"
                        style={{
                          background: "#fff",
                          width: PREVIEW_W,
                          height: PREVIEW_H
                        }}>
                        <img
                          src={uploadedImage}
                          alt="광고주"
                          className="overlay-img overlay-img-wide"
                          style={{
                            width: PREVIEW_W,
                            height: PREVIEW_H
                          }}
                        />
                        {selectedGuideIdx !== null && (
                          <img
                            src={`${GUIDE_LIST[selectedGuideIdx].file}`}
                            alt={`Guide overlay`}
                            className="overlay-img overlay-guide overlay-guide-left"
                            style={{
                              width: PREVIEW_W,
                              height: PREVIEW_H,
                              left: 0,
                              top: 0,
                              opacity: guideOpacity
                            }}
                          />
                        )}
                      </div>
                      <div className="overlay-opacity-slider" style={{ marginTop: 10 }}>
                        <label>
                          가이드 투명도&nbsp;
                          <input
                            type="range"
                            min={0.1}
                            max={1}
                            step={0.05}
                            value={guideOpacity}
                            onChange={e => setGuideOpacity(Number(e.target.value))}
                          />
                          <span className="slider-value">{Math.round(guideOpacity * 100)}%</span>
                        </label>
                      </div>
                    </div>
                    {/* 우측: 가이드 리스트 */}
                    <div className="guide-list-col">
                      <div className="guide-list-header-row">
                        <span className="guide-list-header-label"># 검수 가이드 일치율</span>
                      </div>
                      <ul className="guide-list-ul">
                        {GUIDE_LIST.map((g, idx) => {
                          const errorPercent = errorPercents[idx] !== undefined
                            ? (errorPercents[idx] * 100)
                            : null;
                          const matchPercent = errorPercent !== null
                            ? (100 - errorPercent).toFixed(1)
                            : null;
                          const badgeIdx = recommendOrder.indexOf(idx);
                          const percentColor = badgeIdx >= 0 ? "#22bb55" : "#bfc4cc";
                          return (
                            <li
                              key={g.file}
                              className={`guide-list-item${selectedGuideIdx === idx ? " active" : ""}${badgeIdx >= 0 ? " recommended" : ""}`}
                              onClick={() => setSelectedGuideIdx(idx)}
                            >
                              <div className="guide-list-title-flex">
                                <div className="guide-list-title-left">
                                  <b>{g.name}</b>
                                  {badgeIdx === 0 && <span className="guide-recommend-badge small">추천 1</span>}
                                  {badgeIdx === 1 && <span className="guide-recommend-badge small">추천 2</span>}
                                  {badgeIdx === 2 && <span className="guide-recommend-badge small">추천 3</span>}
                                </div>
                                {matchPercent !== null && (
                                  <span
                                    className="guide-error-percent"
                                    style={{ color: percentColor }}
                                  >
                                    {matchPercent}%
                                  </span>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                )}

                {/* 3. 미리보기 탭 */}
                {currentTab === "preview" && uploadedImage && (
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center", width: "100%",
                    marginTop: 16
                  }}>
                    <div
                      className="mobile-preview-box"
                      style={{
                        width: PREVIEW_MOBILE_W,
                        height: PREVIEW_MOBILE_H,
                        position: "relative",
                        background: "#111",
                        borderRadius: "28px",
                        boxShadow: "0 6px 36px 0 #0c0c0d33",
                        overflow: "hidden",
                        margin: "0 auto"
                      }}
                    >
                      {/* 확인용 모바일 배경 */}
                      <img
                        src={`${CONFIRM_IMAGE}`}
                        alt="확인용 기기"
                        className="preview-confirm-img"
                        style={{
                          width: PREVIEW_MOBILE_W,
                          height: PREVIEW_MOBILE_H,
                          position: "absolute",
                          left: 0, top: 0,
                          objectFit: "cover",
                          zIndex: 1,
                          pointerEvents: "none",
                        }}
                      />
                      {/* 등록소재: 하단 정렬 */}
                      <img
                        src={uploadedImage}
                        alt="등록 소재 오버레이"
                        className="preview-uploaded-img"
                        style={{
                          position: "absolute",
                          left: 0,
                          bottom: 0,
                          width: PREVIEW_MOBILE_W,
                          height: "auto",
                          maxHeight: PREVIEW_MOBILE_H,
                          objectFit: "contain",
                          zIndex: 2,
                          pointerEvents: "none",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* 탭별 조건 안내 */}
                {((currentTab === "basic" || currentTab === "guide" || currentTab === "preview") && !uploadedImage) && (
                  <div className="tab-empty-msg">
                    먼저 소재를 업로드해 주세요.
                  </div>
                )}
              </div>
            </div>
            <div className="multi-overlay-footer">
              ⓒ {new Date().getFullYear()} 광고 소재 검수 툴
            </div>
          </div>
        )}

        {/* 전면형 탭: 준비중(또는 별도 UI) */}
        {materialType === "full" && (
          <div className="multi-overlay-root" style={{alignItems: "center", justifyContent: "center", minHeight: "100vh"}}>
            <div style={{fontSize: "1.5rem", color: "#7b7b7b", marginTop: "120px"}}>전면형 준비중입니다 🛠️</div>
          </div>
        )}
      </div>
    </div>
  );
}

