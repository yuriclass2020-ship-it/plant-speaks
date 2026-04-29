import { useEffect, useState } from "react";
import type { CSSProperties, ChangeEvent } from "react";

type Screen =
  | "start"
  | "home"
  | "observe"
  | "care"
  | "record"
  | "chat"
  | "register"
  | "leafRecord"
  | "soilRecord"
  | "photoRecord";

type Plant = {
  name: string;
  type: string;
  memo: string;
};

type CareState = {
  waterGoal: number;
  sunGoal: number;
  waterCount: number;
  sunCount: number;
};

type ObservationType = "leaf" | "soil" | "photo" | "other";

type ObservationRecord = {
  id: string;
  type: ObservationType;
  title: string;
  date: string;
  dateKey: string;
  firstLabel: string;
  firstValue: string;
  firstIcon: string;
  secondLabel: string;
  secondValue: string;
  secondIcon: string;
  memo: string;
  imageData?: string;
};

type NavItem = {
  screen: "home" | "observe" | "care" | "record";
  label: string;
  icon: string;
};

type FeatureCard = {
  title: string;
  desc: string;
  icon: string;
  action: () => void;
};

type ChoiceOption = {
  label: string;
  icon: string;
  color: string;
};

const CARE_STORAGE_KEY = "plant-speaks-care-state-v1";
const PLANT_STORAGE_KEY = "plant-speaks-plant-v1";
const RECORD_STORAGE_KEY = "plant-speaks-observation-records-v1";
const API_STATE_URL = "http://localhost:8787/api/state";

const defaultCareState: CareState = {
  waterGoal: 1,
  sunGoal: 1,
  waterCount: 0,
  sunCount: 0,
};

type DbAppState = {
  plant: Plant | null;
  careState: CareState;
  records: ObservationRecord[];
};

async function loadStateFromDb(): Promise<DbAppState | null> {
  const response = await fetch(API_STATE_URL);
  const data = (await response.json()) as {
    ok: boolean;
    state?: DbAppState;
  };

  if (!response.ok || !data.ok || !data.state) {
    return null;
  }

  return data.state;
}

async function saveStateToDb(state: DbAppState) {
  await fetch(API_STATE_URL, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ state }),
  });
}

function getTodayLabel() {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
}

function getDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);

  if (!year || !month || !day) {
    return dateKey;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(year, month - 1, day));
}

function createRecordId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function resizeImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const maxSize = 900;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("이미지를 처리할 수 없어요."));
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const resizedImage = canvas.toDataURL("image/jpeg", 0.75);
        resolve(resizedImage);
      };

      image.onerror = () => reject(new Error("이미지를 불러올 수 없어요."));
      image.src = String(reader.result);
    };

    reader.onerror = () => reject(new Error("파일을 읽을 수 없어요."));
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("start");
  const [message, setMessage] = useState("");

  const [plant, setPlant] = useState<Plant | null>(null);
  const [isStateLoaded, setIsStateLoaded] = useState(false);
  const [selectedRecordDateKey, setSelectedRecordDateKey] = useState("all");
  const [plantName, setPlantName] = useState("");
  const [plantType, setPlantType] = useState("");
  const [plantMemo, setPlantMemo] = useState("");

  const [careState, setCareState] = useState<CareState>(defaultCareState);
  const [records, setRecords] = useState<ObservationRecord[]>([]);

  const [leafColor, setLeafColor] = useState("");
  const [leafColorIcon, setLeafColorIcon] = useState("");
  const [leafShape, setLeafShape] = useState("");
  const [leafShapeIcon, setLeafShapeIcon] = useState("");
  const [leafMemo, setLeafMemo] = useState("");

  const [soilState, setSoilState] = useState("");
  const [soilStateIcon, setSoilStateIcon] = useState("");
  const [soilColor, setSoilColor] = useState("");
  const [soilColorIcon, setSoilColorIcon] = useState("");
  const [soilMemo, setSoilMemo] = useState("");

  const [photoChange, setPhotoChange] = useState("");
  const [photoChangeIcon, setPhotoChangeIcon] = useState("");
  const [photoFeeling, setPhotoFeeling] = useState("");
  const [photoFeelingIcon, setPhotoFeelingIcon] = useState("");
  const [photoMemo, setPhotoMemo] = useState("");
  const [photoImageData, setPhotoImageData] = useState("");

  const todayLabel = getTodayLabel();
  const todayKey = getDateKey(new Date());

  const mainImagePath = "/icons/main-plant.png";
  const logoPath = "/icons/plant-logo.png";
  const dateIconPath = "/icons/date.png";

  const leafColorOptions: ChoiceOption[] = [
    { label: "초록색", icon: "/icons/leaf-green.png", color: "#E7F4D9" },
    { label: "노란색", icon: "/icons/leaf-yellow.png", color: "#FFF1B8" },
    { label: "갈색", icon: "/icons/leaf-brown.png", color: "#E8D1B0" },
    { label: "새 잎", icon: "/icons/leaf-new.png", color: "#DDF3D8" },
  ];

  const leafShapeOptions: ChoiceOption[] = [
    { label: "튼튼해요", icon: "/icons/leaf-strong.png", color: "#E4F4DB" },
    { label: "축 처졌어요", icon: "/icons/leaf-droop.png", color: "#FFF0C6" },
    { label: "구멍이 있어요", icon: "/icons/leaf-hole.png", color: "#F7E3C8" },
    { label: "말랐어요", icon: "/icons/leaf-dry.png", color: "#EDD7BE" },
  ];

  const soilStateOptions: ChoiceOption[] = [
    { label: "촉촉해요", icon: "/icons/soil-wet.png", color: "#DDF0FF" },
    { label: "조금 말랐어요", icon: "/icons/soil-dry.png", color: "#F7E1BB" },
    { label: "많이 말랐어요", icon: "/icons/soil-crack.png", color: "#E7C7AA" },
    { label: "잘 모르겠어요", icon: "/icons/unknown.png", color: "#ECECEC" },
  ];

  const soilColorOptions: ChoiceOption[] = [
    { label: "어두워요", icon: "/icons/soil-wet.png", color: "#D8C0A3" },
    { label: "밝아졌어요", icon: "/icons/soil-dry.png", color: "#F2D7AE" },
    { label: "갈라졌어요", icon: "/icons/soil-crack.png", color: "#E2BE9D" },
  ];

  const photoChangeOptions: ChoiceOption[] = [
    { label: "커졌어요", icon: "/icons/growth.png", color: "#E4F4DB" },
    { label: "새 잎이 났어요", icon: "/icons/leaf-new.png", color: "#DDF3D8" },
    { label: "색이 달라졌어요", icon: "/icons/leaf-yellow.png", color: "#FFF1B8" },
    { label: "잘 모르겠어요", icon: "/icons/unknown.png", color: "#ECECEC" },
  ];

  const photoFeelingOptions: ChoiceOption[] = [
    { label: "좋아 보여요", icon: "/icons/main-plant.png", color: "#E4F4DB" },
    { label: "살펴봐야 해요", icon: "/icons/observe.png", color: "#FFF0C6" },
    { label: "돌봄이 필요해요", icon: "/icons/care.png", color: "#F7E3C8" },
  ];

  useEffect(() => {
    let isMounted = true;
    let localPlant: Plant | null = null;
    let localCareState: CareState = defaultCareState;
    let localRecords: ObservationRecord[] = [];

    const savedCareState = localStorage.getItem(CARE_STORAGE_KEY);

    if (savedCareState) {
      try {
        const parsed = JSON.parse(savedCareState) as CareState;

        localCareState = {
          waterGoal: parsed.waterGoal || 1,
          sunGoal: parsed.sunGoal || 1,
          waterCount: parsed.waterCount || 0,
          sunCount: parsed.sunCount || 0,
        };
      } catch {
        localStorage.removeItem(CARE_STORAGE_KEY);
      }
    }

    const savedPlant = localStorage.getItem(PLANT_STORAGE_KEY);

    if (savedPlant) {
      try {
        const parsed = JSON.parse(savedPlant) as Plant;
        localPlant = parsed;
      } catch {
        localStorage.removeItem(PLANT_STORAGE_KEY);
      }
    }

    const savedRecords = localStorage.getItem(RECORD_STORAGE_KEY);

    if (savedRecords) {
      try {
        localRecords = JSON.parse(savedRecords) as ObservationRecord[];
      } catch {
        localStorage.removeItem(RECORD_STORAGE_KEY);
      }
    }

    async function loadInitialState() {
      let nextState: DbAppState = {
        plant: localPlant,
        careState: localCareState,
        records: localRecords,
      };

      try {
        const dbState = await loadStateFromDb();

        if (dbState && (dbState.plant || dbState.records.length > 0)) {
          nextState = dbState;
        }
      } catch {
        nextState = {
          plant: localPlant,
          careState: localCareState,
          records: localRecords,
        };
      }

      if (!isMounted) return;

      setPlant(nextState.plant);
      setPlantName(nextState.plant?.name ?? "");
      setPlantType(nextState.plant?.type ?? "");
      setPlantMemo(nextState.plant?.memo ?? "");
      setCareState(nextState.careState);
      setRecords(nextState.records);
      setIsStateLoaded(true);
    }

    loadInitialState();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isStateLoaded) return;

    if (plant) {
      localStorage.setItem(PLANT_STORAGE_KEY, JSON.stringify(plant));
    } else {
      localStorage.removeItem(PLANT_STORAGE_KEY);
    }

    localStorage.setItem(CARE_STORAGE_KEY, JSON.stringify(careState));
    localStorage.setItem(RECORD_STORAGE_KEY, JSON.stringify(records));

    saveStateToDb({
      plant,
      careState,
      records,
    }).catch((error) => {
      console.error("DB 저장 실패:", error);
    });
  }, [careState, isStateLoaded, plant, records]);

  const plantDisplayName = plant?.name || "초록이";
  const plantDisplayType = plant?.type || "아직 등록되지 않은 식물";
  const plantDisplayMemo = plant?.memo || "식물을 등록하면 이곳에 소개가 보여요.";

  const todayRecords = records.filter(
    (record) => record.dateKey === todayKey || record.date === todayLabel
  );
  const pastRecords = records.filter(
    (record) => record.dateKey !== todayKey && record.date !== todayLabel
  );
  const visibleRecords =
    selectedRecordDateKey === "all"
      ? records
      : records.filter(
          (record) =>
            record.dateKey === selectedRecordDateKey ||
            record.date === formatDateKey(selectedRecordDateKey)
        );
  const photoRecords = visibleRecords.filter((record) => record.type === "photo");
  const leafRecords = visibleRecords.filter((record) => record.type === "leaf");
  const soilRecords = visibleRecords.filter((record) => record.type === "soil");
  const otherRecords = visibleRecords.filter((record) => record.type === "other");

  const navItems: NavItem[] = [
    { screen: "home", label: "홈", icon: "/icons/home.png" },
    { screen: "observe", label: "관찰", icon: "/icons/observe.png" },
    { screen: "care", label: "돌보기", icon: "/icons/care.png" },
    { screen: "record", label: "기록", icon: "/icons/record.png" },
  ];

  const observeCards: FeatureCard[] = [
    {
      title: "사진 기록",
      desc: "사진을 찍고 변화를 남겨요",
      icon: "/icons/camera.png",
      action: () => setScreen("photoRecord"),
    },
    {
      title: "잎 관찰",
      desc: "잎의 색과 모양을 살펴봐요",
      icon: "/icons/leaf.png",
      action: () => setScreen("leafRecord"),
    },
    {
      title: "흙 관찰",
      desc: "흙이 말랐는지 확인해요",
      icon: "/icons/soil.png",
      action: () => setScreen("soilRecord"),
    },
  ];

  const savePlant = () => {
    if (!plantName.trim()) {
      alert("식물 이름을 입력해 주세요.");
      return;
    }

    const nextPlant: Plant = {
      name: plantName.trim(),
      type: plantType.trim() || "종류를 아직 모르는 식물",
      memo: plantMemo.trim() || "오늘부터 관찰을 시작해요.",
    };

    setPlant(nextPlant);
    localStorage.setItem(PLANT_STORAGE_KEY, JSON.stringify(nextPlant));

    alert(`${nextPlant.name}이 등록되었어요.`);
    setScreen("home");
  };

  const deletePlant = () => {
    const confirmed = window.confirm("등록한 식물 정보를 삭제할까요?");
    if (!confirmed) return;

    setPlant(null);
    setPlantName("");
    setPlantType("");
    setPlantMemo("");
    localStorage.removeItem(PLANT_STORAGE_KEY);

    alert("식물 정보가 삭제되었어요.");
    setScreen("home");
  };

  const increaseGoal = (key: "waterGoal" | "sunGoal") => {
    setCareState((prev) => ({
      ...prev,
      [key]: Math.min(9, prev[key] + 1),
    }));
  };

  const decreaseGoal = (key: "waterGoal" | "sunGoal") => {
    setCareState((prev) => ({
      ...prev,
      [key]: Math.max(1, prev[key] - 1),
    }));
  };

  const increaseCount = (key: "waterCount" | "sunCount") => {
    setCareState((prev) => ({
      ...prev,
      [key]: prev[key] + 1,
    }));
  };

  const resetTodayCounts = () => {
    setCareState((prev) => ({
      ...prev,
      waterCount: 0,
      sunCount: 0,
    }));
  };

  const handleSendMessage = () => {
    if (!message.trim()) return;

    alert(
      `${plantDisplayName}이 말해요: "${message}"라고 물어봤구나! 같이 살펴보자.`
    );

    setMessage("");
  };

  const handlePhotoFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 선택할 수 있어요.");
      return;
    }

    try {
      const resizedImage = await resizeImageFile(file);
      setPhotoImageData(resizedImage);
    } catch {
      alert("사진을 불러오지 못했어요. 다른 사진을 선택해 주세요.");
    }
  };

  const removePhotoImage = () => {
    setPhotoImageData("");
  };

  const saveLeafRecord = () => {
    if (!leafColor || !leafShape) {
      alert("잎 색깔과 잎 모양을 선택해 주세요.");
      return;
    }

    const nextRecord: ObservationRecord = {
      id: createRecordId(),
      type: "leaf",
      title: "잎 관찰",
      date: todayLabel,
      dateKey: todayKey,
      firstLabel: "잎 색깔",
      firstValue: leafColor,
      firstIcon: leafColorIcon,
      secondLabel: "잎 모양",
      secondValue: leafShape,
      secondIcon: leafShapeIcon,
      memo: leafMemo.trim() || "메모가 없어요.",
    };

    setRecords((prev) => [nextRecord, ...prev]);
    setLeafColor("");
    setLeafColorIcon("");
    setLeafShape("");
    setLeafShapeIcon("");
    setLeafMemo("");

    alert("잎 관찰 기록이 저장되었어요.");
    setScreen("record");
  };

  const saveSoilRecord = () => {
    if (!soilState || !soilColor) {
      alert("흙 상태와 흙 색깔을 선택해 주세요.");
      return;
    }

    const nextRecord: ObservationRecord = {
      id: createRecordId(),
      type: "soil",
      title: "흙 관찰",
      date: todayLabel,
      dateKey: todayKey,
      firstLabel: "흙 상태",
      firstValue: soilState,
      firstIcon: soilStateIcon,
      secondLabel: "흙 색깔",
      secondValue: soilColor,
      secondIcon: soilColorIcon,
      memo: soilMemo.trim() || "메모가 없어요.",
    };

    setRecords((prev) => [nextRecord, ...prev]);
    setSoilState("");
    setSoilStateIcon("");
    setSoilColor("");
    setSoilColorIcon("");
    setSoilMemo("");

    alert("흙 관찰 기록이 저장되었어요.");
    setScreen("record");
  };

  const savePhotoRecord = () => {
    if (!photoChange || !photoFeeling) {
      alert("오늘의 변화와 느낌을 선택해 주세요.");
      return;
    }

    const nextRecord: ObservationRecord = {
      id: createRecordId(),
      type: "photo",
      title: "사진 기록",
      date: todayLabel,
      dateKey: todayKey,
      firstLabel: "오늘의 변화",
      firstValue: photoChange,
      firstIcon: photoChangeIcon,
      secondLabel: "오늘의 느낌",
      secondValue: photoFeeling,
      secondIcon: photoFeelingIcon,
      memo: photoMemo.trim() || "메모가 없어요.",
      imageData: photoImageData || undefined,
    };

    setRecords((prev) => [nextRecord, ...prev]);
    setPhotoChange("");
    setPhotoChangeIcon("");
    setPhotoFeeling("");
    setPhotoFeelingIcon("");
    setPhotoMemo("");
    setPhotoImageData("");

    alert("사진 기록이 저장되었어요.");
    setScreen("record");
  };

  const deleteRecord = (id: string) => {
    const confirmed = window.confirm("이 기록을 삭제할까요?");
    if (!confirmed) return;

    setRecords((prev) => prev.filter((record) => record.id !== id));
  };

  const renderBottomNav = () => {
    return (
      <nav style={styles.bottomNav}>
        {navItems.map((item) => {
          const isActive = screen === item.screen;

          return (
            <button
              key={item.screen}
              type="button"
              style={isActive ? styles.navItemActive : styles.navItem}
              onClick={() => setScreen(item.screen)}
            >
              <img src={item.icon} alt={item.label} style={styles.navLogo} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    );
  };

  const renderTopBar = (title: string, desc: string) => {
    return (
      <header style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <img src={mainImagePath} alt="식물" style={styles.topBarIcon} />

          <div>
            <h1 style={styles.topBarTitle}>{title}</h1>
            <p style={styles.topBarDesc}>{desc}</p>
          </div>
        </div>

        <button
          type="button"
          style={styles.settingsButton}
          onClick={() => alert("설정 기능은 나중에 연결할 예정이에요.")}
        >
          <img src="/icons/settings.png" alt="설정" style={styles.settingsIcon} />
          <span>설정</span>
        </button>
      </header>
    );
  };

  const renderChoiceCard = (
    option: ChoiceOption,
    selectedValue: string,
    onClick: () => void
  ) => {
    const isSelected = selectedValue === option.label;

    return (
      <button
        key={option.label}
        type="button"
        style={{
          ...styles.choiceCard,
          background: option.color,
          border: isSelected ? "4px solid #4F8A3C" : "2px solid #D8CFB8",
        }}
        onClick={onClick}
      >
        <img src={option.icon} alt={option.label} style={styles.choiceIcon} />
        <span style={styles.choiceLabel}>{option.label}</span>
      </button>
    );
  };

  const renderRecordCard = (record: ObservationRecord) => {
    return (
      <article key={record.id} style={styles.recordCard}>
        {record.imageData && (
          <img
            src={record.imageData}
            alt="식물 기록 사진"
            style={styles.recordPhoto}
          />
        )}

        <div style={styles.recordCardHeader}>
          <div>
            <p style={styles.recordDate}>{record.date}</p>
            <h3 style={styles.recordTitle}>{record.title}</h3>
          </div>

          <button
            type="button"
            style={styles.recordDeleteButton}
            onClick={() => deleteRecord(record.id)}
          >
            삭제
          </button>
        </div>

        <div style={styles.recordChoiceRow}>
          <div style={styles.recordChoiceBox}>
            <img
              src={record.firstIcon}
              alt={record.firstValue}
              style={styles.recordChoiceIcon}
            />
            <p style={styles.recordChoiceLabel}>{record.firstLabel}</p>
            <strong style={styles.recordChoiceText}>{record.firstValue}</strong>
          </div>

          <div style={styles.recordChoiceBox}>
            <img
              src={record.secondIcon}
              alt={record.secondValue}
              style={styles.recordChoiceIcon}
            />
            <p style={styles.recordChoiceLabel}>{record.secondLabel}</p>
            <strong style={styles.recordChoiceText}>{record.secondValue}</strong>
          </div>
        </div>

        <p style={styles.recordMemo}>{record.memo}</p>
      </article>
    );
  };

  const renderRecordGroup = (
    title: string,
    icon: string,
    groupRecords: ObservationRecord[],
    emptyText: string
  ) => {
    return (
      <section style={styles.recordGroupBox}>
        <div style={styles.recordGroupHeader}>
          <div style={styles.recordGroupTitleBox}>
            <img src={icon} alt={title} style={styles.recordGroupIcon} />
            <h3 style={styles.recordGroupTitle}>{title}</h3>
          </div>

          <span style={styles.recordGroupCount}>{groupRecords.length}개</span>
        </div>

        {groupRecords.length === 0 ? (
          <div style={styles.recordGroupEmpty}>{emptyText}</div>
        ) : (
          <div style={styles.recordGrid}>
            {groupRecords.map((record) => renderRecordCard(record))}
          </div>
        )}
      </section>
    );
  };

  if (screen === "start") {
    return (
      <div style={styles.page}>
        <div style={styles.landscapeFrame}>
          <section style={styles.startLeft}>
            <img
              src={mainImagePath}
              alt="식물이 말해요 대표 이미지"
              style={styles.startMainImage}
            />
          </section>

          <section style={styles.startRight}>
            <h1 style={styles.startTitle}>식물이 말해요</h1>

            <p style={styles.startSubtitle}>
              아이들이 식물을 관찰하고, 돌보고, 기록하는 가로형 식물 대화 놀이
            </p>

            <button
              type="button"
              style={styles.primaryButton}
              onClick={() => setScreen("home")}
            >
              시작하기
            </button>
          </section>
        </div>
      </div>
    );
  }

  if (screen === "leafRecord") {
    return (
      <div style={styles.page}>
        <div style={styles.landscapeFrame}>
          <div style={styles.screenContent}>
            <header style={styles.chatTopBar}>
              <button
                type="button"
                style={styles.backButton}
                onClick={() => setScreen("observe")}
              >
                ←
              </button>

              <img src="/icons/leaf.png" alt="잎 관찰" style={styles.topBarIcon} />

              <div>
                <h1 style={styles.topBarTitle}>잎 관찰 기록</h1>
                <p style={styles.topBarDesc}>그림 카드를 눌러 잎 상태를 남겨요</p>
              </div>
            </header>

            <main style={styles.observationLayout}>
              <section style={styles.observationSideCard}>
                <img src="/icons/leaf.png" alt="잎" style={styles.observationSideIcon} />
                <h2 style={styles.observationSideTitle}>잎을 살펴봐요</h2>
                <p style={styles.observationSideText}>
                  색깔과 모양을 하나씩 골라 기록해요.
                </p>
              </section>

              <section style={styles.observationFormCard}>
                <div>
                  <h3 style={styles.questionTitle}>1. 잎 색깔은 어떤가요?</h3>
                  <div style={styles.choiceGrid}>
                    {leafColorOptions.map((option) =>
                      renderChoiceCard(option, leafColor, () => {
                        setLeafColor(option.label);
                        setLeafColorIcon(option.icon);
                      })
                    )}
                  </div>
                </div>

                <div>
                  <h3 style={styles.questionTitle}>2. 잎 모양은 어떤가요?</h3>
                  <div style={styles.choiceGrid}>
                    {leafShapeOptions.map((option) =>
                      renderChoiceCard(option, leafShape, () => {
                        setLeafShape(option.label);
                        setLeafShapeIcon(option.icon);
                      })
                    )}
                  </div>
                </div>

                <label style={styles.memoLabel}>
                  메모를 남겨요
                  <textarea
                    value={leafMemo}
                    onChange={(event) => setLeafMemo(event.target.value)}
                    placeholder="예: 오늘 새 잎을 발견했어요."
                    style={styles.memoTextarea}
                  />
                </label>

                <button type="button" style={styles.saveButton} onClick={saveLeafRecord}>
                  잎 관찰 저장하기
                </button>
              </section>
            </main>
          </div>

          {renderBottomNav()}
        </div>
      </div>
    );
  }

  if (screen === "soilRecord") {
    return (
      <div style={styles.page}>
        <div style={styles.landscapeFrame}>
          <div style={styles.screenContent}>
            <header style={styles.chatTopBar}>
              <button
                type="button"
                style={styles.backButton}
                onClick={() => setScreen("observe")}
              >
                ←
              </button>

              <img src="/icons/soil.png" alt="흙 관찰" style={styles.topBarIcon} />

              <div>
                <h1 style={styles.topBarTitle}>흙 관찰 기록</h1>
                <p style={styles.topBarDesc}>그림 카드를 눌러 흙 상태를 남겨요</p>
              </div>
            </header>

            <main style={styles.observationLayout}>
              <section style={styles.observationSideCard}>
                <img src="/icons/soil.png" alt="흙" style={styles.observationSideIcon} />
                <h2 style={styles.observationSideTitle}>흙을 살펴봐요</h2>
                <p style={styles.observationSideText}>
                  흙의 촉촉함과 색을 골라 기록해요.
                </p>
              </section>

              <section style={styles.observationFormCard}>
                <div>
                  <h3 style={styles.questionTitle}>1. 흙 상태는 어떤가요?</h3>
                  <div style={styles.choiceGrid}>
                    {soilStateOptions.map((option) =>
                      renderChoiceCard(option, soilState, () => {
                        setSoilState(option.label);
                        setSoilStateIcon(option.icon);
                      })
                    )}
                  </div>
                </div>

                <div>
                  <h3 style={styles.questionTitle}>2. 흙 색깔은 어떤가요?</h3>
                  <div style={styles.choiceGrid}>
                    {soilColorOptions.map((option) =>
                      renderChoiceCard(option, soilColor, () => {
                        setSoilColor(option.label);
                        setSoilColorIcon(option.icon);
                      })
                    )}
                  </div>
                </div>

                <label style={styles.memoLabel}>
                  메모를 남겨요
                  <textarea
                    value={soilMemo}
                    onChange={(event) => setSoilMemo(event.target.value)}
                    placeholder="예: 흙이 조금 말라 보여요."
                    style={styles.memoTextarea}
                  />
                </label>

                <button type="button" style={styles.saveButton} onClick={saveSoilRecord}>
                  흙 관찰 저장하기
                </button>
              </section>
            </main>
          </div>

          {renderBottomNav()}
        </div>
      </div>
    );
  }

  if (screen === "photoRecord") {
    return (
      <div style={styles.page}>
        <div style={styles.landscapeFrame}>
          <div style={styles.screenContent}>
            <header style={styles.chatTopBar}>
              <button
                type="button"
                style={styles.backButton}
                onClick={() => setScreen("observe")}
              >
                ←
              </button>

              <img src="/icons/camera.png" alt="사진 기록" style={styles.topBarIcon} />

              <div>
                <h1 style={styles.topBarTitle}>사진 기록</h1>
                <p style={styles.topBarDesc}>사진과 함께 오늘의 변화를 남겨요</p>
              </div>
            </header>

            <main style={styles.photoRecordLayout}>
              <section style={styles.photoUploadCard}>
                <img
                  src="/icons/camera.png"
                  alt="사진"
                  style={styles.observationSideIcon}
                />

                <h2 style={styles.observationSideTitle}>사진 남기기</h2>

                <p style={styles.observationSideText}>
                  식물 사진을 찍거나 앨범에서 골라요.
                </p>

                <label style={styles.photoUploadButton}>
                  사진 찍기 / 선택하기
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoFileChange}
                    style={styles.hiddenFileInput}
                  />
                </label>

                {photoImageData ? (
                  <div style={styles.photoPreviewBox}>
                    <img
                      src={photoImageData}
                      alt="선택한 식물 사진"
                      style={styles.photoPreviewImage}
                    />

                    <button
                      type="button"
                      style={styles.removePhotoButton}
                      onClick={removePhotoImage}
                    >
                      사진 지우기
                    </button>
                  </div>
                ) : (
                  <div style={styles.emptyPhotoBox}>
                    아직 선택한 사진이 없어요.
                  </div>
                )}
              </section>

              <section style={styles.observationFormCard}>
                <div>
                  <h3 style={styles.questionTitle}>1. 어떤 변화가 보이나요?</h3>
                  <div style={styles.choiceGrid}>
                    {photoChangeOptions.map((option) =>
                      renderChoiceCard(option, photoChange, () => {
                        setPhotoChange(option.label);
                        setPhotoChangeIcon(option.icon);
                      })
                    )}
                  </div>
                </div>

                <div>
                  <h3 style={styles.questionTitle}>2. 오늘 식물은 어때 보여요?</h3>
                  <div style={styles.choiceGrid}>
                    {photoFeelingOptions.map((option) =>
                      renderChoiceCard(option, photoFeeling, () => {
                        setPhotoFeeling(option.label);
                        setPhotoFeelingIcon(option.icon);
                      })
                    )}
                  </div>
                </div>

                <label style={styles.memoLabel}>
                  메모를 남겨요
                  <textarea
                    value={photoMemo}
                    onChange={(event) => setPhotoMemo(event.target.value)}
                    placeholder="예: 잎이 조금 더 커진 것 같아요."
                    style={styles.memoTextarea}
                  />
                </label>

                <button type="button" style={styles.saveButton} onClick={savePhotoRecord}>
                  사진 기록 저장하기
                </button>
              </section>
            </main>
          </div>

          {renderBottomNav()}
        </div>
      </div>
    );
  }

  if (screen === "register") {
    return (
      <div style={styles.page}>
        <div style={styles.landscapeFrame}>
          <div style={styles.screenContent}>
            <header style={styles.chatTopBar}>
              <button
                type="button"
                style={styles.backButton}
                onClick={() => setScreen("home")}
              >
                ←
              </button>

              <img src={mainImagePath} alt="식물 등록" style={styles.topBarIcon} />

              <div>
                <h1 style={styles.topBarTitle}>식물 등록</h1>
                <p style={styles.topBarDesc}>관찰할 식물의 이름과 특징을 정해요</p>
              </div>
            </header>

            <main style={styles.registerLayout}>
              <section style={styles.registerPreviewCard}>
                <img
                  src={mainImagePath}
                  alt="대표 식물"
                  style={styles.registerPreviewImage}
                />

                <h2 style={styles.registerPreviewTitle}>
                  {plantName.trim() || "새 식물"}
                </h2>

                <p style={styles.registerPreviewText}>
                  {plantType.trim() || "식물 종류를 입력해 보세요."}
                </p>

                <p style={styles.registerPreviewMemo}>
                  {plantMemo.trim() ||
                    "아이들이 관찰할 내용을 짧게 적어둘 수 있어요."}
                </p>
              </section>

              <section style={styles.registerFormCard}>
                <label style={styles.formLabel}>
                  식물 이름
                  <input
                    value={plantName}
                    onChange={(event) => setPlantName(event.target.value)}
                    placeholder="예: 초록이"
                    style={styles.formInput}
                  />
                </label>

                <label style={styles.formLabel}>
                  식물 종류
                  <input
                    value={plantType}
                    onChange={(event) => setPlantType(event.target.value)}
                    placeholder="예: 몬스테라, 강낭콩, 상추"
                    style={styles.formInput}
                  />
                </label>

                <label style={styles.formLabel}>
                  관찰 메모
                  <textarea
                    value={plantMemo}
                    onChange={(event) => setPlantMemo(event.target.value)}
                    placeholder="예: 오늘 처음 만난 식물이에요."
                    style={styles.formTextarea}
                  />
                </label>

                <div style={styles.registerButtonRow}>
                  {plant && (
                    <button
                      type="button"
                      style={styles.deleteButton}
                      onClick={deletePlant}
                    >
                      삭제하기
                    </button>
                  )}

                  <button type="button" style={styles.saveButton} onClick={savePlant}>
                    저장하기
                  </button>
                </div>
              </section>
            </main>
          </div>

          {renderBottomNav()}
        </div>
      </div>
    );
  }

  if (screen === "chat") {
    return (
      <div style={styles.page}>
        <div style={styles.landscapeFrame}>
          <div style={styles.screenContent}>
            <header style={styles.chatTopBar}>
              <button
                type="button"
                style={styles.backButton}
                onClick={() => setScreen("home")}
              >
                ←
              </button>

              <img src={logoPath} alt="대화" style={styles.topBarIcon} />

              <div>
                <h1 style={styles.topBarTitle}>{plantDisplayName}와 대화</h1>
                <p style={styles.topBarDesc}>식물에게 궁금한 것을 물어봐요</p>
              </div>
            </header>

            <main style={styles.chatLayout}>
              <section style={styles.chatPlantPanel}>
                <img
                  src={mainImagePath}
                  alt={plantDisplayName}
                  style={styles.chatPlantImage}
                />

                <h2 style={styles.chatPlantName}>{plantDisplayName}</h2>

                <p style={styles.chatPlantDesc}>
                  오늘도 나를 관찰해줘서 고마워!
                </p>
              </section>

              <section style={styles.chatMainPanel}>
                <div style={styles.speechBubble}>
                  안녕! 나는 {plantDisplayName}야. 오늘 나에게 궁금한 걸 물어봐.
                </div>

                <div style={styles.exampleBox}>
                  <p style={styles.exampleTitle}>예시 질문</p>
                  <p style={styles.exampleText}>“물을 줘도 될까?”</p>
                  <p style={styles.exampleText}>“잎이 왜 시들었어?”</p>
                  <p style={styles.exampleText}>“햇빛을 얼마나 좋아해?”</p>
                </div>

                <div style={styles.inputArea}>
                  <input
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="식물에게 물어보세요..."
                    style={styles.input}
                  />

                  <button
                    type="button"
                    style={styles.sendButton}
                    onClick={handleSendMessage}
                  >
                    보내기
                  </button>
                </div>
              </section>
            </main>
          </div>

          {renderBottomNav()}
        </div>
      </div>
    );
  }

  if (screen === "observe") {
    return (
      <div style={styles.page}>
        <div style={styles.landscapeFrame}>
          <div style={styles.screenContent}>
            {renderTopBar("관찰", "식물의 모습을 자세히 살펴봐요")}

            <main style={styles.tabMainLayout}>
              <section style={styles.sideInfoCard}>
                <img
                  src="/icons/observe.png"
                  alt="관찰"
                  style={styles.sideInfoIcon}
                />

                <h2 style={styles.sideInfoTitle}>오늘은 무엇을 볼까요?</h2>

                <p style={styles.sideInfoText}>
                  사진, 잎, 흙을 차례대로 살펴보면 식물의 변화를 더 잘 알 수 있어요.
                </p>
              </section>

              <section style={styles.horizontalCardGrid}>
                {observeCards.map((card) => (
                  <button
                    key={card.title}
                    type="button"
                    style={styles.largeFeatureCard}
                    onClick={card.action}
                  >
                    <img src={card.icon} alt={card.title} style={styles.featureIcon} />
                    <h3 style={styles.featureTitle}>{card.title}</h3>
                    <p style={styles.featureDesc}>{card.desc}</p>
                  </button>
                ))}
              </section>
            </main>
          </div>

          {renderBottomNav()}
        </div>
      </div>
    );
  }

  if (screen === "care") {
    const waterDone = careState.waterCount >= careState.waterGoal;
    const sunDone = careState.sunCount >= careState.sunGoal;

    return (
      <div style={styles.page}>
        <div style={styles.landscapeFrame}>
          <div style={styles.screenContent}>
            {renderTopBar("돌보기", "물 주기와 햇빛 보기를 횟수로 세요")}

            <main style={styles.careLayout}>
              <section style={styles.sideInfoCard}>
                <img src="/icons/care.png" alt="돌보기" style={styles.sideInfoIcon} />

                <h2 style={styles.sideInfoTitle}>오늘의 돌보기</h2>

                <p style={styles.sideInfoText}>
                  물 주기와 햇빛 보기를 눌러서 오늘 몇 번 했는지 세어봐요.
                </p>

                <button
                  type="button"
                  style={styles.resetButton}
                  onClick={resetTodayCounts}
                >
                  오늘 횟수 초기화
                </button>
              </section>

              <section style={styles.careCardRow}>
                <div style={styles.careCard}>
                  <img src="/icons/water.png" alt="물 주기" style={styles.careIcon} />

                  <h3 style={styles.careTitle}>물 주기</h3>

                  <p style={waterDone ? styles.doneStatusText : styles.statusText}>
                    {careState.waterCount} / {careState.waterGoal}회
                  </p>

                  <div style={styles.goalControl}>
                    <button
                      type="button"
                      style={styles.goalButton}
                      onClick={() => decreaseGoal("waterGoal")}
                    >
                      -
                    </button>

                    <span style={styles.goalText}>목표 {careState.waterGoal}회</span>

                    <button
                      type="button"
                      style={styles.goalButton}
                      onClick={() => increaseGoal("waterGoal")}
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    style={waterDone ? styles.countButtonDone : styles.countButton}
                    onClick={() => increaseCount("waterCount")}
                  >
                    물 줬어요
                  </button>
                </div>

                <div style={styles.careCard}>
                  <img src="/icons/sun.png" alt="햇빛 보기" style={styles.careIcon} />

                  <h3 style={styles.careTitle}>햇빛 보기</h3>

                  <p style={sunDone ? styles.doneStatusText : styles.statusText}>
                    {careState.sunCount} / {careState.sunGoal}회
                  </p>

                  <div style={styles.goalControl}>
                    <button
                      type="button"
                      style={styles.goalButton}
                      onClick={() => decreaseGoal("sunGoal")}
                    >
                      -
                    </button>

                    <span style={styles.goalText}>목표 {careState.sunGoal}회</span>

                    <button
                      type="button"
                      style={styles.goalButton}
                      onClick={() => increaseGoal("sunGoal")}
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    style={sunDone ? styles.countButtonDone : styles.countButton}
                    onClick={() => increaseCount("sunCount")}
                  >
                    햇빛 봤어요
                  </button>
                </div>
              </section>
            </main>
          </div>

          {renderBottomNav()}
        </div>
      </div>
    );
  }

  if (screen === "record") {
    return (
      <div style={styles.page}>
        <div style={styles.landscapeFrame}>
          <div style={styles.screenContent}>
            {renderTopBar("기록", "관찰한 내용을 모아봐요")}

            <main style={styles.recordLayout}>
              <section style={styles.sideInfoCard}>
                <img src="/icons/record.png" alt="기록" style={styles.sideInfoIcon} />

                <h2 style={styles.sideInfoTitle}>기록 모음</h2>

                <p style={styles.sideInfoText}>
                  오늘 기록과 지난 기록을 사진, 잎, 흙, 기타로 나누어 볼 수 있어요.
                </p>
              </section>

              <section style={styles.recordListPanel}>
                <div style={styles.todayRecordHeader}>
                  <div>
                    <p style={styles.todayRecordLabel}>저장된 전체 기록</p>
                    <h2 style={styles.todayRecordDate}>
                      {selectedRecordDateKey === "all"
                        ? "전체 날짜"
                        : formatDateKey(selectedRecordDateKey)}
                    </h2>
                  </div>

                  <span style={styles.todayRecordCount}>
                    오늘 {todayRecords.length}개 · 지난 기록 {pastRecords.length}개
                  </span>
                </div>

                <div style={styles.recordDateFilterBox}>
                  <input
                    type="date"
                    value={
                      selectedRecordDateKey === "all"
                        ? todayKey
                        : selectedRecordDateKey
                    }
                    onChange={(event) =>
                      setSelectedRecordDateKey(event.target.value)
                    }
                    style={styles.recordDateInput}
                  />

                  <button
                    type="button"
                    style={styles.recordDateFilterButton}
                    onClick={() => setSelectedRecordDateKey(todayKey)}
                  >
                    오늘 보기
                  </button>

                  <button
                    type="button"
                    style={styles.recordDateFilterButton}
                    onClick={() => setSelectedRecordDateKey("all")}
                  >
                    전체 보기
                  </button>
                </div>

                <div style={styles.recordCategoryStack}>
                  {renderRecordGroup(
                    "사진",
                    "/icons/camera.png",
                    photoRecords,
                    "아직 사진 기록이 없어요."
                  )}

                  {renderRecordGroup(
                    "잎",
                    "/icons/leaf.png",
                    leafRecords,
                    "아직 잎 관찰 기록이 없어요."
                  )}

                  {renderRecordGroup(
                    "흙",
                    "/icons/soil.png",
                    soilRecords,
                    "아직 흙 관찰 기록이 없어요."
                  )}

                  {renderRecordGroup(
                    "기타",
                    "/icons/note.png",
                    otherRecords,
                    "아직 기타 기록이 없어요."
                  )}
                </div>
              </section>
            </main>
          </div>

          {renderBottomNav()}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.landscapeFrame}>
        <div style={styles.screenContent}>
          {renderTopBar("식물이 말해요", "오늘 식물에게 말을 걸어볼까요?")}

          <main style={styles.homeLayout}>
            <section style={styles.homeLeftColumn}>
              <div style={styles.dateCard}>
                <div>
                  <p style={styles.dateLabel}>오늘 날짜</p>
                  <h2 style={styles.dateText}>{todayLabel}</h2>
                </div>

                <img src={dateIconPath} alt="오늘 날짜" style={styles.dateIcon} />
              </div>

              <div style={styles.myPlantCard}>
                <div style={styles.myPlantTextBox}>
                  <div style={styles.myPlantTopLine}>
                    <p style={styles.sectionLabel}>나의 식물</p>

                    <button
                      type="button"
                      style={styles.editPlantButton}
                      onClick={() => setScreen("register")}
                    >
                      {plant ? "수정" : "등록"}
                    </button>
                  </div>

                  <h2 style={styles.myPlantName}>{plantDisplayName}</h2>

                  <p style={styles.myPlantType}>{plantDisplayType}</p>

                  <p style={styles.myPlantDesc}>{plantDisplayMemo}</p>
                </div>

                <img
                  src={mainImagePath}
                  alt={plantDisplayName}
                  style={styles.myPlantImage}
                />
              </div>

              <div style={styles.todayCard}>
                <p style={styles.sectionLabel}>오늘 할 일</p>

                <div style={styles.todayButtonRow}>
                  <button
                    type="button"
                    style={styles.todayButton}
                    onClick={() => setScreen("observe")}
                  >
                    <img src="/icons/observe.png" alt="관찰" style={styles.todayIcon} />
                    관찰하기
                  </button>

                  <button
                    type="button"
                    style={styles.todayButton}
                    onClick={() => setScreen("care")}
                  >
                    <img src="/icons/care.png" alt="돌보기" style={styles.todayIcon} />
                    돌보기
                  </button>

                  <button
                    type="button"
                    style={styles.todayButton}
                    onClick={() => setScreen("record")}
                  >
                    <img src="/icons/record.png" alt="기록" style={styles.todayIcon} />
                    기록 보기
                  </button>
                </div>
              </div>
            </section>

            <section style={styles.homeRightColumn}>
              <button
                type="button"
                style={styles.chatHeroCard}
                onClick={() => setScreen("chat")}
              >
                <img src={logoPath} alt="식물과 대화하기" style={styles.chatHeroIcon} />

                <div style={styles.chatHeroTextBox}>
                  <h2 style={styles.chatHeroTitle}>
                    {plantDisplayName}와 대화하기
                  </h2>
                  <p style={styles.chatHeroDesc}>
                    식물에게 궁금한 점을 물어봐요.
                  </p>
                </div>

                <span style={styles.chatHeroArrow}>→</span>
              </button>
            </section>
          </main>
        </div>

        {renderBottomNav()}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#F8F5EA",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "18px",
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  landscapeFrame: {
    width: "100%",
    maxWidth: "1080px",
    minHeight: "620px",
    background: "#FFFDF6",
    borderRadius: "30px",
    boxShadow: "0 14px 34px rgba(75, 90, 65, 0.16)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },

  screenContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  },

  startLeft: {
    flex: 1,
    background: "#EEF5E7",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },

  startRight: {
    flex: 1,
    padding: "56px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },

  startMainImage: {
    width: "250px",
    height: "250px",
    objectFit: "contain",
  },

  startTitle: {
    margin: 0,
    fontSize: "46px",
    color: "#2F4F2F",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  startSubtitle: {
    margin: "18px 0 0",
    color: "#6B7F5A",
    fontSize: "19px",
    lineHeight: 1.55,
    fontWeight: 700,
    wordBreak: "keep-all",
  },

  primaryButton: {
    marginTop: "40px",
    width: "190px",
    border: "none",
    background: "#5F8D4E",
    color: "white",
    padding: "16px 34px",
    borderRadius: "999px",
    fontSize: "19px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(95, 141, 78, 0.3)",
  },

  topBar: {
    height: "88px",
    borderBottom: "1px solid #ECE6D3",
    background: "#FFFDF6",
    padding: "0 28px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  topBarLeft: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },

  topBarIcon: {
    width: "52px",
    height: "52px",
    objectFit: "contain",
    flexShrink: 0,
  },

  topBarTitle: {
    margin: 0,
    color: "#2F4F2F",
    fontSize: "25px",
    fontWeight: 900,
  },

  topBarDesc: {
    margin: "5px 0 0",
    color: "#6B7F5A",
    fontSize: "15px",
    fontWeight: 700,
    wordBreak: "keep-all",
  },

  settingsButton: {
    border: "1px solid #D8CFB8",
    background: "#FFFFFF",
    color: "#4F6B3F",
    borderRadius: "999px",
    padding: "8px 14px",
    fontSize: "14px",
    fontWeight: 900,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },

  settingsIcon: {
    width: "24px",
    height: "24px",
    objectFit: "contain",
  },

  homeLayout: {
    flex: 1,
    padding: "24px 28px",
    display: "grid",
    gridTemplateColumns: "1fr 1.08fr",
    gap: "22px",
    minHeight: 0,
  },

  homeLeftColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },

  homeRightColumn: {
    display: "flex",
  },

  dateCard: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "24px",
    padding: "18px 22px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    boxShadow: "0 4px 10px rgba(80, 80, 60, 0.05)",
  },

  dateLabel: {
    margin: 0,
    color: "#5F704B",
    fontSize: "15px",
    fontWeight: 900,
  },

  dateText: {
    margin: "6px 0 0",
    color: "#2F4F2F",
    fontSize: "24px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  dateIcon: {
    width: "54px",
    height: "54px",
    objectFit: "contain",
    flexShrink: 0,
  },

  myPlantCard: {
    flex: 1,
    minHeight: "170px",
    background: "#F6F1DE",
    border: "1px solid #E4DABF",
    borderRadius: "26px",
    padding: "22px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "18px",
  },

  myPlantTextBox: {
    flex: 1,
  },

  myPlantTopLine: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "8px",
  },

  sectionLabel: {
    margin: 0,
    color: "#5F704B",
    fontSize: "16px",
    fontWeight: 900,
  },

  editPlantButton: {
    border: "none",
    background: "#E7F0DD",
    color: "#3F6B34",
    borderRadius: "999px",
    padding: "6px 12px",
    fontSize: "13px",
    fontWeight: 900,
    cursor: "pointer",
  },

  myPlantName: {
    margin: 0,
    color: "#2F4F2F",
    fontSize: "34px",
    fontWeight: 900,
  },

  myPlantType: {
    margin: "8px 0 0",
    color: "#4F6B3F",
    fontSize: "16px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  myPlantDesc: {
    margin: "8px 0 0",
    color: "#6B7F5A",
    fontSize: "16px",
    fontWeight: 700,
    lineHeight: 1.45,
    wordBreak: "keep-all",
  },

  myPlantImage: {
    width: "126px",
    height: "126px",
    objectFit: "contain",
  },

  todayCard: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "26px",
    padding: "20px",
  },

  todayButtonRow: {
    marginTop: "14px",
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "12px",
  },

  todayButton: {
    border: "1px solid #E4DABF",
    background: "#FFFDF6",
    color: "#2F4F2F",
    borderRadius: "18px",
    padding: "14px 10px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    fontSize: "15px",
    fontWeight: 900,
    cursor: "pointer",
    wordBreak: "keep-all",
  },

  todayIcon: {
    width: "46px",
    height: "46px",
    objectFit: "contain",
  },

  chatHeroCard: {
    width: "100%",
    background: "linear-gradient(135deg, #76A866, #4F7C43)",
    border: "none",
    borderRadius: "30px",
    padding: "34px",
    color: "white",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "22px",
    textAlign: "left",
    boxShadow: "0 12px 24px rgba(80, 120, 60, 0.24)",
  },

  chatHeroIcon: {
    width: "126px",
    height: "126px",
    objectFit: "contain",
    flexShrink: 0,
  },

  chatHeroTextBox: {
    flex: 1,
  },

  chatHeroTitle: {
    margin: 0,
    fontSize: "34px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  chatHeroDesc: {
    margin: "12px 0 0",
    fontSize: "18px",
    fontWeight: 700,
    lineHeight: 1.45,
    opacity: 0.95,
    wordBreak: "keep-all",
  },

  chatHeroArrow: {
    width: "50px",
    height: "50px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.24)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "30px",
    fontWeight: 900,
    flexShrink: 0,
  },

  registerLayout: {
    flex: 1,
    padding: "28px",
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    gap: "24px",
    minHeight: 0,
  },

  registerPreviewCard: {
    background: "#F6F1DE",
    border: "1px solid #E4DABF",
    borderRadius: "28px",
    padding: "28px 24px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  registerPreviewImage: {
    width: "150px",
    height: "150px",
    objectFit: "contain",
    marginBottom: "18px",
  },

  registerPreviewTitle: {
    margin: 0,
    color: "#2F4F2F",
    fontSize: "30px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  registerPreviewText: {
    margin: "10px 0 0",
    color: "#4F6B3F",
    fontSize: "17px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  registerPreviewMemo: {
    margin: "12px 0 0",
    color: "#6B7F5A",
    fontSize: "16px",
    fontWeight: 700,
    lineHeight: 1.45,
    wordBreak: "keep-all",
  },

  registerFormCard: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "28px",
    padding: "28px",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },

  formLabel: {
    color: "#2F4F2F",
    fontSize: "17px",
    fontWeight: 900,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  formInput: {
    border: "1px solid #D8CFB8",
    borderRadius: "18px",
    padding: "15px 16px",
    fontSize: "17px",
    color: "#2F4F2F",
    outline: "none",
    background: "#FFFDF6",
    fontWeight: 700,
  },

  formTextarea: {
    border: "1px solid #D8CFB8",
    borderRadius: "18px",
    padding: "15px 16px",
    fontSize: "17px",
    color: "#2F4F2F",
    outline: "none",
    background: "#FFFDF6",
    minHeight: "110px",
    resize: "none",
    fontWeight: 700,
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  registerButtonRow: {
    marginTop: "auto",
    display: "flex",
    justifyContent: "flex-end",
    gap: "12px",
  },

  deleteButton: {
    border: "none",
    background: "#F4E0D8",
    color: "#9A4634",
    borderRadius: "999px",
    padding: "14px 24px",
    fontSize: "17px",
    fontWeight: 900,
    cursor: "pointer",
  },

  saveButton: {
    border: "none",
    background: "#5F8D4E",
    color: "white",
    borderRadius: "999px",
    padding: "14px 28px",
    fontSize: "17px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(95, 141, 78, 0.24)",
  },

  tabMainLayout: {
    flex: 1,
    padding: "28px",
    display: "grid",
    gridTemplateColumns: "280px 1fr",
    gap: "22px",
    minHeight: 0,
  },

  sideInfoCard: {
    background: "#F6F1DE",
    border: "1px solid #E4DABF",
    borderRadius: "26px",
    padding: "28px 22px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
  },

  sideInfoIcon: {
    width: "100px",
    height: "100px",
    objectFit: "contain",
    marginBottom: "18px",
  },

  sideInfoTitle: {
    margin: 0,
    color: "#2F4F2F",
    fontSize: "24px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  sideInfoText: {
    margin: "12px 0 0",
    color: "#6B7F5A",
    fontSize: "16px",
    fontWeight: 700,
    lineHeight: 1.55,
    wordBreak: "keep-all",
  },

  horizontalCardGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "18px",
  },

  largeFeatureCard: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "26px",
    padding: "24px 18px",
    textAlign: "center",
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(80, 80, 60, 0.06)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  featureIcon: {
    width: "96px",
    height: "96px",
    objectFit: "contain",
    marginBottom: "16px",
  },

  featureTitle: {
    margin: 0,
    color: "#2F4F2F",
    fontSize: "23px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  featureDesc: {
    margin: "10px 0 0",
    color: "#7B7B67",
    fontSize: "16px",
    fontWeight: 700,
    lineHeight: 1.45,
    wordBreak: "keep-all",
  },

  observationLayout: {
    flex: 1,
    padding: "24px 28px",
    display: "grid",
    gridTemplateColumns: "260px 1fr",
    gap: "22px",
    minHeight: 0,
  },

  photoRecordLayout: {
    flex: 1,
    padding: "24px 28px",
    display: "grid",
    gridTemplateColumns: "300px 1fr",
    gap: "22px",
    minHeight: 0,
  },

  observationSideCard: {
    background: "#F6F1DE",
    border: "1px solid #E4DABF",
    borderRadius: "26px",
    padding: "24px 20px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
  },

  photoUploadCard: {
    background: "#F6F1DE",
    border: "1px solid #E4DABF",
    borderRadius: "26px",
    padding: "22px 18px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    minHeight: 0,
  },

  observationSideIcon: {
    width: "108px",
    height: "108px",
    objectFit: "contain",
    marginBottom: "14px",
  },

  observationSideTitle: {
    margin: 0,
    color: "#2F4F2F",
    fontSize: "24px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  observationSideText: {
    margin: "10px 0 0",
    color: "#6B7F5A",
    fontSize: "15px",
    fontWeight: 700,
    lineHeight: 1.45,
    wordBreak: "keep-all",
  },

  photoUploadButton: {
    marginTop: "16px",
    background: "#5F8D4E",
    color: "white",
    borderRadius: "999px",
    padding: "13px 20px",
    fontSize: "16px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(95, 141, 78, 0.22)",
  },

  hiddenFileInput: {
    display: "none",
  },

  photoPreviewBox: {
    marginTop: "16px",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
  },

  photoPreviewImage: {
    width: "100%",
    maxHeight: "180px",
    objectFit: "cover",
    borderRadius: "20px",
    border: "2px solid #D8CFB8",
  },

  emptyPhotoBox: {
    marginTop: "16px",
    width: "100%",
    minHeight: "140px",
    border: "2px dashed #D8CFB8",
    borderRadius: "20px",
    color: "#7B7B67",
    fontSize: "15px",
    fontWeight: 800,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#FFFDF6",
  },

  removePhotoButton: {
    border: "none",
    background: "#F4E0D8",
    color: "#9A4634",
    borderRadius: "999px",
    padding: "9px 14px",
    fontSize: "14px",
    fontWeight: 900,
    cursor: "pointer",
  },

  observationFormCard: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "28px",
    padding: "22px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },

  questionTitle: {
    margin: "0 0 10px",
    color: "#2F4F2F",
    fontSize: "19px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  choiceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "12px",
  },

  choiceCard: {
    borderRadius: "20px",
    padding: "10px 8px",
    minHeight: "118px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },

  choiceIcon: {
    width: "58px",
    height: "58px",
    objectFit: "contain",
  },

  choiceLabel: {
    color: "#2F4F2F",
    fontSize: "15px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  memoLabel: {
    color: "#2F4F2F",
    fontSize: "17px",
    fontWeight: 900,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  memoTextarea: {
    border: "1px solid #D8CFB8",
    borderRadius: "18px",
    padding: "13px 15px",
    fontSize: "16px",
    color: "#2F4F2F",
    outline: "none",
    background: "#FFFDF6",
    minHeight: "78px",
    resize: "none",
    fontWeight: 700,
    fontFamily:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  recordLayout: {
    flex: 1,
    padding: "28px",
    display: "grid",
    gridTemplateColumns: "260px 1fr",
    gap: "22px",
    minHeight: 0,
  },

  recordListPanel: {
    minHeight: 0,
    overflowY: "auto",
    paddingRight: "4px",
  },

  recordDateFilterBox: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "20px",
    padding: "14px",
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    gap: "10px",
    alignItems: "center",
    marginBottom: "16px",
  },

  recordDateInput: {
    border: "1px solid #D8CFB8",
    borderRadius: "14px",
    padding: "11px 12px",
    color: "#2F4F2F",
    background: "#FFFDF6",
    fontSize: "15px",
    fontWeight: 800,
  },

  recordDateFilterButton: {
    border: "none",
    background: "#E7F0DD",
    color: "#3F6B34",
    borderRadius: "999px",
    padding: "11px 14px",
    fontSize: "14px",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  todayRecordHeader: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "24px",
    padding: "18px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },

  todayRecordLabel: {
    margin: 0,
    color: "#5F704B",
    fontSize: "16px",
    fontWeight: 900,
  },

  todayRecordDate: {
    margin: "6px 0 0",
    color: "#2F4F2F",
    fontSize: "25px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  todayRecordCount: {
    background: "#E7F0DD",
    color: "#3F6B34",
    borderRadius: "999px",
    padding: "9px 14px",
    fontSize: "15px",
    fontWeight: 900,
  },

  recordCategoryStack: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },

  recordGroupBox: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "24px",
    padding: "16px",
  },

  recordGroupHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
  },

  recordGroupTitleBox: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },

  recordGroupIcon: {
    width: "38px",
    height: "38px",
    objectFit: "contain",
  },

  recordGroupTitle: {
    margin: 0,
    color: "#2F4F2F",
    fontSize: "21px",
    fontWeight: 900,
  },

  recordGroupCount: {
    background: "#F2F7EA",
    color: "#4F6B3F",
    borderRadius: "999px",
    padding: "6px 11px",
    fontSize: "13px",
    fontWeight: 900,
  },

  recordGroupEmpty: {
    background: "#FFFDF6",
    border: "1px dashed #D8CFB8",
    borderRadius: "18px",
    padding: "18px",
    color: "#7B7B67",
    fontSize: "15px",
    fontWeight: 800,
    textAlign: "center",
  },

  recordGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  },

  recordCard: {
    background: "#FFFDF6",
    border: "1px solid #E8E1C8",
    borderRadius: "22px",
    padding: "16px",
    boxShadow: "0 4px 10px rgba(80, 80, 60, 0.05)",
  },

  recordPhoto: {
    width: "100%",
    height: "150px",
    objectFit: "cover",
    borderRadius: "18px",
    marginBottom: "14px",
    border: "1px solid #E8E1C8",
  },

  recordCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "14px",
  },

  recordDate: {
    margin: 0,
    color: "#7B7B67",
    fontSize: "13px",
    fontWeight: 800,
  },

  recordTitle: {
    margin: "4px 0 0",
    color: "#2F4F2F",
    fontSize: "20px",
    fontWeight: 900,
  },

  recordDeleteButton: {
    border: "none",
    background: "#F4E0D8",
    color: "#9A4634",
    borderRadius: "999px",
    padding: "6px 10px",
    fontSize: "13px",
    fontWeight: 900,
    cursor: "pointer",
    flexShrink: 0,
  },

  recordChoiceRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },

  recordChoiceBox: {
    background: "#FFFFFF",
    borderRadius: "18px",
    padding: "12px 8px",
    textAlign: "center",
    border: "1px solid #EFE7D2",
  },

  recordChoiceIcon: {
    width: "52px",
    height: "52px",
    objectFit: "contain",
    marginBottom: "6px",
  },

  recordChoiceLabel: {
    margin: 0,
    color: "#7B7B67",
    fontSize: "12px",
    fontWeight: 800,
  },

  recordChoiceText: {
    display: "block",
    marginTop: "3px",
    color: "#2F4F2F",
    fontSize: "15px",
    fontWeight: 900,
    wordBreak: "keep-all",
  },

  recordMemo: {
    margin: "12px 0 0",
    background: "#FFFFFF",
    border: "1px solid #EFE7D2",
    borderRadius: "16px",
    padding: "10px 12px",
    color: "#5F704B",
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: 1.45,
    wordBreak: "keep-all",
  },

  careLayout: {
    flex: 1,
    padding: "28px",
    display: "grid",
    gridTemplateColumns: "280px 1fr",
    gap: "22px",
    minHeight: 0,
  },

  resetButton: {
    marginTop: "22px",
    border: "none",
    background: "#FFFFFF",
    color: "#4F6B3F",
    borderRadius: "999px",
    padding: "12px 18px",
    fontSize: "15px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(80, 80, 60, 0.06)",
  },

  careCardRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px",
  },

  careCard: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "28px",
    padding: "28px 22px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  careIcon: {
    width: "108px",
    height: "108px",
    objectFit: "contain",
    marginBottom: "14px",
  },

  careTitle: {
    margin: 0,
    color: "#2F4F2F",
    fontSize: "26px",
    fontWeight: 900,
  },

  statusText: {
    margin: "12px 0",
    color: "#7B7B67",
    fontSize: "25px",
    fontWeight: 900,
  },

  doneStatusText: {
    margin: "12px 0",
    color: "#4F8A3C",
    fontSize: "25px",
    fontWeight: 900,
  },

  goalControl: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "18px",
  },

  goalButton: {
    width: "42px",
    height: "42px",
    border: "none",
    borderRadius: "50%",
    background: "#E7F0DD",
    color: "#3F6B34",
    fontSize: "25px",
    fontWeight: 900,
    cursor: "pointer",
  },

  goalText: {
    color: "#4F6B3F",
    fontSize: "16px",
    fontWeight: 900,
    minWidth: "80px",
  },

  countButton: {
    border: "none",
    background: "#5F8D4E",
    color: "white",
    borderRadius: "999px",
    padding: "15px 28px",
    fontSize: "18px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(95, 141, 78, 0.24)",
  },

  countButtonDone: {
    border: "none",
    background: "#8DBE7A",
    color: "white",
    borderRadius: "999px",
    padding: "15px 28px",
    fontSize: "18px",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 8px 18px rgba(95, 141, 78, 0.24)",
  },

  chatTopBar: {
    height: "88px",
    borderBottom: "1px solid #ECE6D3",
    background: "#FFFDF6",
    padding: "0 28px",
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },

  backButton: {
    border: "none",
    background: "#F1EBD8",
    width: "42px",
    height: "42px",
    borderRadius: "50%",
    cursor: "pointer",
    fontSize: "24px",
    color: "#4B5F3C",
    flexShrink: 0,
  },

  chatLayout: {
    flex: 1,
    padding: "28px",
    display: "grid",
    gridTemplateColumns: "320px 1fr",
    gap: "22px",
  },

  chatPlantPanel: {
    background: "#F6F1DE",
    border: "1px solid #E4DABF",
    borderRadius: "26px",
    padding: "24px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },

  chatPlantImage: {
    width: "156px",
    height: "156px",
    objectFit: "contain",
    marginBottom: "18px",
  },

  chatPlantName: {
    margin: 0,
    color: "#2F4F2F",
    fontSize: "29px",
    fontWeight: 900,
  },

  chatPlantDesc: {
    margin: "10px 0 0",
    color: "#6B7F5A",
    fontSize: "16px",
    fontWeight: 700,
    wordBreak: "keep-all",
  },

  chatMainPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },

  speechBubble: {
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    padding: "20px 22px",
    borderRadius: "22px",
    color: "#42553A",
    fontSize: "19px",
    fontWeight: 700,
    lineHeight: 1.55,
    boxShadow: "0 4px 10px rgba(80, 80, 60, 0.06)",
    wordBreak: "keep-all",
  },

  exampleBox: {
    background: "#F3EEDC",
    borderRadius: "22px",
    padding: "20px",
  },

  exampleTitle: {
    margin: "0 0 10px",
    color: "#2F4F2F",
    fontWeight: 900,
    fontSize: "18px",
  },

  exampleText: {
    margin: "8px 0",
    color: "#5F704B",
    fontSize: "16px",
    fontWeight: 700,
  },

  inputArea: {
    marginTop: "auto",
    background: "#FFFFFF",
    border: "1px solid #E8E1C8",
    borderRadius: "999px",
    padding: "8px",
    display: "flex",
    gap: "8px",
  },

  input: {
    flex: 1,
    border: "none",
    borderRadius: "999px",
    padding: "14px 16px",
    fontSize: "16px",
    outline: "none",
    background: "transparent",
  },

  sendButton: {
    border: "none",
    background: "#5F8D4E",
    color: "white",
    borderRadius: "999px",
    padding: "0 24px",
    fontSize: "16px",
    fontWeight: 900,
    cursor: "pointer",
  },

  bottomNav: {
    height: "86px",
    borderTop: "1px solid #ECE6D3",
    background: "#FFFFFF",
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
  },

  navItem: {
    border: "none",
    background: "transparent",
    color: "#5F704B",
    fontSize: "14px",
    fontWeight: 900,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: "4px",
    cursor: "pointer",
  },

  navItemActive: {
    border: "none",
    background: "#F2F7EA",
    color: "#2F4F2F",
    fontSize: "14px",
    fontWeight: 900,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: "4px",
    cursor: "pointer",
  },

  navLogo: {
    width: "34px",
    height: "34px",
    objectFit: "contain",
  },
};
