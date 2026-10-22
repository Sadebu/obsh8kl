import React, { useState, useEffect, useCallback } from 'react';
import { stations, StationData } from './data/stations';
import { allMiniGames } from './data/miniGames';
import { teacherKeys } from './data/teacherKeys';

type Screen = 'welcome' | 'station' | 'minigame' | 'summary' | 'diagnosis' | 'teacher';
type StationPhase = 'narrative' | 'question' | 'feedback';

interface StudentResult {
  name: string;
  class?: string;
  startTime: number;
  endTime: number;
  stationScores: Record<string, number>;
  miniGameScores: Record<string, number>;
  totalScore: number;
  grade: string;
  errors: string[];
  comments?: string;
  teacherApproved?: boolean;
}

function App() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [fastMode, setFastMode] = useState(false);
  const [currentStationIdx, setCurrentStationIdx] = useState(0);
  const [stationPhase, setStationPhase] = useState<StationPhase>('narrative');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSkipped, setIsSkipped] = useState(false);
  const [stationScores, setStationScores] = useState<Record<string, number>>({});
  const [miniGameScores, setMiniGameScores] = useState<Record<string, number>>({});
  const [currentMiniGameId, setCurrentMiniGameId] = useState<string | null>(null);
  const [miniGameIdx, setMiniGameIdx] = useState(0);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [errors, setErrors] = useState<string[]>([]);

  // Teacher
  const [teacherAuth, setTeacherAuth] = useState(false);
  const [teacherPassword, setTeacherPassword] = useState('');
  const [teacherTab, setTeacherTab] = useState<'journal' | 'keys' | 'aggregate'>('journal');

  const currentStation = stations[currentStationIdx];

  const getGrade = (score: number): string => {
    if (score >= 85) return '5';
    if (score >= 70) return '4';
    if (score >= 50) return '3';
    return '2';
  };

  const getTotalScore = (): number => {
    const stationValues = Object.values(stationScores);
    const miniValues = Object.values(miniGameScores);
    const all = [...stationValues, ...miniValues];
    if (all.length === 0) return 0;
    return Math.round(all.reduce((a, b) => a + b, 0) / all.length);
  };

  const handleStart = () => {
    if (!studentName.trim()) return;
    setStartTime(Date.now());
    setScreen('station');
    setCurrentStationIdx(0);
    setStationPhase('narrative');
    setSelectedOption(null);
    setIsSkipped(false);
    setMiniGameIdx(0);
  };

  const handleOptionSelect = (idx: number) => {
    if (stationPhase === 'feedback') return;
    setSelectedOption(idx);
    setStationPhase('feedback');
    setIsSkipped(false);
    const option = currentStation.options[idx];
    let score = 0;
    if (option.rating === 'best') score = 100;
    else if (option.rating === 'acceptable') score = 60;
    else score = 20;
    setStationScores(prev => ({ ...prev, [currentStation.id]: score }));
    if (!option.correct) {
      setErrors(prev => [...prev, `${currentStation.title}: ${option.feedback}`]);
    }
  };

  const handleSkipQuestion = () => {
    setStationPhase('feedback');
    setIsSkipped(true);
    const correctIdx = currentStation.options.findIndex(o => o.correct);
    setSelectedOption(correctIdx);
    setStationScores(prev => ({ ...prev, [currentStation.id]: 0 }));
  };

  const handleGoToMiniGame = () => {
    if (fastMode || !currentStation.miniGames || currentStation.miniGames.length === 0) {
      setScreen('summary');
      return;
    }
    const mgId = currentStation.miniGames[0];
    setCurrentMiniGameId(mgId);
    setMiniGameIdx(0);
    setScreen('minigame');
  };

  const handleMiniGameComplete = (score: number) => {
    const mgId = currentMiniGameId!;
    setMiniGameScores(prev => ({ ...prev, [mgId]: score }));
    // Check if there are more mini-games for this station
    const nextMgIdx = miniGameIdx + 1;
    if (nextMgIdx < currentStation.miniGames.length) {
      setMiniGameIdx(nextMgIdx);
      setCurrentMiniGameId(currentStation.miniGames[nextMgIdx]);
    } else {
      setScreen('summary');
    }
  };

  const handleSkipMiniGame = () => {
    const mgId = currentMiniGameId!;
    setMiniGameScores(prev => ({ ...prev, [mgId]: 0 }));
    const nextMgIdx = miniGameIdx + 1;
    if (nextMgIdx < currentStation.miniGames.length) {
      setMiniGameIdx(nextMgIdx);
      setCurrentMiniGameId(currentStation.miniGames[nextMgIdx]);
    } else {
      setScreen('summary');
    }
  };

  const handleNextStation = () => {
    if (currentStationIdx < stations.length - 1) {
      setCurrentStationIdx(prev => prev + 1);
      setStationPhase('narrative');
      setSelectedOption(null);
      setIsSkipped(false);
      setMiniGameIdx(0);
      setScreen('station');
    } else {
      setScreen('diagnosis');
    }
  };

  const saveResult = useCallback(() => {
    const result: StudentResult = {
      name: studentName,
      class: studentClass || undefined,
      startTime,
      endTime: Date.now(),
      stationScores,
      miniGameScores,
      totalScore: getTotalScore(),
      grade: getGrade(getTotalScore()),
      errors
    };
    const existing = JSON.parse(localStorage.getItem('historyQuest_results_v2') || '[]');
    existing.push(result);
    localStorage.setItem('historyQuest_results_v2', JSON.stringify(existing));
  }, [studentName, studentClass, startTime, stationScores, miniGameScores, errors]);

  useEffect(() => {
    if (screen === 'diagnosis') {
      saveResult();
    }
  }, [screen, saveResult]);

  // ===== RENDER =====
  if (screen === 'welcome') {
    return <WelcomeScreen
      name={studentName} setName={setStudentName}
      studentClass={studentClass} setClass={setStudentClass}
      fastMode={fastMode} setFastMode={setFastMode}
      onStart={handleStart}
      onTeacher={() => setScreen('teacher')}
    />;
  }

  if (screen === 'teacher') {
    return <TeacherScreen
      auth={teacherAuth} password={teacherPassword} setPassword={setTeacherPassword}
      onAuth={() => {
        if (teacherPassword === 'teacher123') setTeacherAuth(true);
        else alert('Неверный пароль');
      }}
      tab={teacherTab} setTab={setTeacherTab}
      onBack={() => { setScreen('welcome'); setTeacherAuth(false); setTeacherPassword(''); }}
    />;
  }

  if (screen === 'diagnosis') {
    return <DiagnosisScreen
      stationScores={stationScores}
      miniGameScores={miniGameScores}
      totalScore={getTotalScore()}
      grade={getGrade(getTotalScore())}
      errors={errors}
      onRestart={() => {
        setScreen('welcome');
        setStudentName('');
        setStudentClass('');
        setCurrentStationIdx(0);
        setStationPhase('narrative');
        setSelectedOption(null);
        setIsSkipped(false);
        setStationScores({});
        setMiniGameScores({});
        setErrors([]);
      }}
    />;
  }

  if (screen === 'minigame' && currentMiniGameId) {
    const mgData = allMiniGames[currentMiniGameId];
    return (
      <div className="app-container">
        <Header
          title={`Мини-игра ${miniGameIdx + 1}/${currentStation.miniGames.length}`}
          progress={`Станция ${currentStation.number}: ${currentStation.title}`}
          onBack={() => setScreen('summary')}
        />
        <div className="main-content">
          <div className="skip-bar">
            <button className="btn btn-skip btn-small" onClick={handleSkipMiniGame}>Пропустить →</button>
          </div>
          <MiniGameComponent gameType={mgData.type} gameData={mgData} onComplete={handleMiniGameComplete} />
        </div>
      </div>
    );
  }

  if (screen === 'summary') {
    return (
      <div className="app-container">
        <Header title="Что повторили" progress={`Станция ${currentStation.number}/${stations.length}`} />
        <div className="main-content">
          <SummaryCard station={currentStation} />
          <div className="nav-buttons">
            <button className="btn btn-primary" onClick={handleNextStation}>
              {currentStationIdx < stations.length - 1 ? 'Следующая станция →' : 'Итоговая диагностика →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Station screen
  return (
    <div className="app-container">
      <Header
        title={`Станция ${currentStation.number}`}
        progress={`${currentStation.part}${currentStation.number} • ${currentStation.paragraphs}`}
      />
      <div className="main-content">
        <div className="station-screen">
          <div className="station-header">
            <div className="station-part">Часть {currentStation.part} • {currentStation.topic}</div>
            <div className="station-number">{currentStation.paragraphs}</div>
            <div className="station-title">{currentStation.title}</div>
            <div className="station-period">{currentStation.period}</div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${((currentStationIdx + 1) / stations.length) * 100}%` }} />
            </div>
          </div>

          {stationPhase === 'narrative' && (
            <>
              <div className="station-narrative">
                {currentStation.narrative.map((p, i) => <p key={i}>{p}</p>)}
                {currentStation.source && <div className="source-block">{currentStation.source}</div>}
              </div>
              <div className="nav-buttons">
                <button className="btn btn-primary" onClick={() => setStationPhase('question')}>Сделать выбор →</button>
                <button className="btn btn-skip" onClick={() => setStationPhase('question')}>Сразу к вопросу →</button>
              </div>
            </>
          )}

          {stationPhase === 'question' && (
            <div className="choice-section">
              <div className="choice-question">{currentStation.question}</div>
              <div className="choice-options">
                {currentStation.options.map((opt, idx) => (
                  <div key={idx}
                    className={`choice-option ${selectedOption === idx ? 'selected' : ''}`}
                    onClick={() => handleOptionSelect(idx)}>
                    {opt.text}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-skip btn-small" onClick={handleSkipQuestion}>Пропустить вопрос →</button>
              </div>
            </div>
          )}

          {stationPhase === 'feedback' && selectedOption !== null && (
            <>
              <div className="choice-section">
                <div className="choice-question">{currentStation.question}</div>
                <div className="choice-options">
                  {currentStation.options.map((opt, idx) => (
                    <div key={idx}
                      className={`choice-option ${idx === selectedOption ? (opt.correct ? 'correct' : 'incorrect') : (opt.correct ? 'correct' : '')}`}>
                      {opt.text}
                    </div>
                  ))}
                </div>
              </div>
              {isSkipped ? (
                <div className="feedback-box feedback-skipped">
                  <strong>⏭ Вопрос пропущен</strong>
                  <p>Выше подсвечен правильный ответ. Рекомендуем перечитать {currentStation.paragraphs}.</p>
                  <p className="feedback-ref">{currentStation.options.find(o => o.correct)?.ref}</p>
                </div>
              ) : (
                <div className={`feedback-box ${currentStation.options[selectedOption].correct ? 'feedback-correct' : 'feedback-incorrect'}`}>
                  <strong>{currentStation.options[selectedOption].correct ? '✓ Верно!' : '✗ Не совсем...'}</strong>
                  <p>{currentStation.options[selectedOption].feedback}</p>
                  <p className="feedback-ref">{currentStation.options[selectedOption].ref}</p>
                </div>
              )}
              <div className="nav-buttons">
                <button className="btn btn-primary" onClick={handleGoToMiniGame}>
                  {fastMode ? 'Обобщающая карточка →' : 'Мини-игра →'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <DownloadButton />
    </div>
  );
}

// ===== COMPONENTS =====

function Header({ title, progress, onBack }: { title: string; progress: string; onBack?: () => void }) {
  return (
    <div className="header">
      <div className="header-left">
        <div className="header-title">{title}</div>
        <div className="header-progress">{progress}</div>
      </div>
      <div className="header-actions">
        {onBack && <button className="header-btn" onClick={onBack}>← Назад</button>}
      </div>
    </div>
  );
}

function WelcomeScreen({ name, setName, studentClass, setClass, fastMode, setFastMode, onStart, onTeacher }: {
  name: string; setName: (n: string) => void;
  studentClass: string; setClass: (c: string) => void;
  fastMode: boolean; setFastMode: (f: boolean) => void;
  onStart: () => void; onTeacher: () => void;
}) {
  return (
    <div className="app-container">
      <div className="welcome-screen">
        <svg className="welcome-emblem" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
          <circle cx="60" cy="60" r="55" fill="#1a237e" opacity="0.1" />
          <path d="M60 20 L75 50 L60 45 L45 50 Z" fill="#1a237e" />
          <rect x="40" y="50" width="40" height="45" fill="#b71c1c" opacity="0.8" rx="2" />
          <rect x="45" y="55" width="10" height="15" fill="white" rx="1" />
          <rect x="65" y="55" width="10" height="15" fill="white" rx="1" />
          <rect x="55" y="75" width="10" height="20" fill="#f9a825" rx="1" />
          <text x="60" y="110" textAnchor="middle" fontSize="8" fill="#1a237e" fontWeight="700">АРХИВ</text>
        </svg>
        <div className="welcome-title">🏛️ Хранитель архива эпохи</div>
        <div className="welcome-subtitle">
          Сюжетный квест-повторение по Новой истории 8 класса.<br />
          Глава I «Век Просвещения» (§1–13) + «Французская революция и наполеоновская эпоха» (§16–22).<br />
          9 станций, мини-игры, обобщающие карточки. Время: 40–45 минут.
        </div>
        <div className="welcome-form">
          <input className="welcome-input" type="text" placeholder="Ваше имя и фамилия *"
            value={name} onChange={e => setName(e.target.value)} />
          <input className="welcome-input" type="text" placeholder="Класс (необязательно)"
            value={studentClass} onChange={e => setClass(e.target.value)} />
          <div className="welcome-mode-toggle">
            <button className={`mode-btn ${!fastMode ? 'active' : ''}`} onClick={() => setFastMode(false)}>
              📖 Полный режим (40–45 мин)
            </button>
            <button className={`mode-btn ${fastMode ? 'active' : ''}`} onClick={() => setFastMode(true)}>
              ⚡ Быстрый режим (только мини-игры)
            </button>
          </div>
          <button className="btn btn-primary" onClick={onStart} disabled={!name.trim()}>
            Начать квест
          </button>
          <button className="btn btn-outline btn-small" onClick={onTeacher}>
            🔐 Страница учителя
          </button>
        </div>
      </div>
      <DownloadButton />
    </div>
  );
}

function SummaryCard({ station }: { station: StationData }) {
  return (
    <div className="summary-card">
      <h3>📋 Что повторили: {station.title}</h3>
      <div className="summary-section">
        <h4>📅 Лента дат</h4>
        <div className="dates-timeline">
          {station.summary.dates.map((d, i) => <span key={i} className="date-badge">{d}</span>)}
        </div>
      </div>
      <div className="summary-section">
        <h4>📖 Ключевые понятия</h4>
        <ul className="concepts-list">
          {station.summary.concepts.map((c, i) => (
            <li key={i}><span className="concept-term">{c.term}</span> — {c.definition}</li>
          ))}
        </ul>
      </div>
      <div className="summary-section">
        <h4>⚡ Причинно-следственная связь</h4>
        <div className="cause-effect">{station.summary.causeEffect}</div>
      </div>
      <div className="summary-section">
        <h4>🔗 Вопрос на связь</h4>
        <div className="connection-question">{station.summary.connectionQuestion}</div>
      </div>
    </div>
  );
}

// ===== MINI GAMES =====

function MiniGameComponent({ gameType, gameData, onComplete }: {
  gameType: string; gameData: any; onComplete: (score: number) => void;
}) {
  switch (gameType) {
    case 'timeline': return <TimelineGame data={gameData} onComplete={onComplete} />;
    case 'match': return <MatchGame data={gameData} onComplete={onComplete} />;
    case 'concept': return <ConceptGame data={gameData} onComplete={onComplete} />;
    case 'distribution': return <DistributionGame data={gameData} onComplete={onComplete} />;
    case 'truefalse': return <TrueFalseGame data={gameData} onComplete={onComplete} />;
    default: return <div>Игра не найдена</div>;
  }
}

function TimelineGame({ data, onComplete }: { data: any; onComplete: (score: number) => void }) {
  const [items, setItems] = useState(() => [...data.data].sort(() => Math.random() - 0.5));
  const [submitted, setSubmitted] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  const moveItem = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= items.length) return;
    const newItems = [...items];
    [newItems[idx], newItems[newIdx]] = [newItems[newIdx], newItems[idx]];
    setItems(newItems);
  };

  const checkOrder = () => {
    setSubmitted(true);
    const correctCount = items.filter((item, idx) => item.order === idx + 1).length;
    setFinalScore(Math.round((correctCount / items.length) * 100));
  };

  return (
    <div className="minigame-container">
      <div className="minigame-title">{data.title}</div>
      <div className="minigame-desc">{data.desc}</div>
      <div className="timeline-items">
        {items.map((item: any, idx: number) => (
          <div key={item.id} className={`timeline-item ${submitted ? (item.order === idx + 1 ? 'correct' : 'incorrect') : ''}`}>
            <div className="timeline-arrows">
              <button className="arrow-btn" onClick={() => moveItem(idx, -1)} disabled={submitted}>↑</button>
              <button className="arrow-btn" onClick={() => moveItem(idx, 1)} disabled={submitted}>↓</button>
            </div>
            <span style={{ flex: 1 }}>{item.text}</span>
            {submitted && <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{item.year}</span>}
          </div>
        ))}
      </div>
      {!submitted ? (
        <button className="btn btn-primary" onClick={checkOrder}>Проверить порядок</button>
      ) : (
        <div>
          <div className="minigame-result">Результат: {finalScore}%</div>
          <button className="btn btn-primary" onClick={() => onComplete(finalScore!)}>Продолжить →</button>
        </div>
      )}
    </div>
  );
}

function MatchGame({ data, onComplete }: { data: any; onComplete: (score: number) => void }) {
  const pairs = data.data as { left: string; right: string }[];
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [matched, setMatched] = useState<Record<string, string>>({});
  const [wrongPair, setWrongPair] = useState<{ left: string; right: string } | null>(null);
  const [shuffledRight] = useState(() => [...pairs.map(p => p.right)].sort(() => Math.random() - 0.5));

  useEffect(() => {
    if (selectedLeft && selectedRight) {
      const pair = pairs.find(p => p.left === selectedLeft);
      if (pair && pair.right === selectedRight) {
        setMatched(prev => ({ ...prev, [selectedLeft]: selectedRight }));
        setWrongPair(null);
      } else {
        setWrongPair({ left: selectedLeft, right: selectedRight });
        setTimeout(() => setWrongPair(null), 1000);
      }
      setSelectedLeft(null);
      setSelectedRight(null);
    }
  }, [selectedLeft, selectedRight, pairs]);

  useEffect(() => {
    if (Object.keys(matched).length === pairs.length) {
      setTimeout(() => onComplete(100), 500);
    }
  }, [matched, pairs.length, onComplete]);

  return (
    <div className="minigame-container">
      <div className="minigame-title">{data.title}</div>
      <div className="minigame-desc">{data.desc}</div>
      <div className="minigame-score">Совпадений: {Object.keys(matched).length} / {pairs.length}</div>
      <div className="match-container">
        <div className="match-column">
          <div className="match-column-title">Термин / Деятель</div>
          {pairs.map((p, i) => (
            <div key={i}
              className={`match-item ${matched[p.left] ? 'matched' : ''} ${selectedLeft === p.left ? 'selected' : ''} ${wrongPair?.left === p.left ? 'wrong' : ''}`}
              onClick={() => !matched[p.left] && setSelectedLeft(p.left)}>
              {p.left}
            </div>
          ))}
        </div>
        <div className="match-column">
          <div className="match-column-title">Определение / Роль</div>
          {shuffledRight.map((right, i) => {
            const isMatched = Object.values(matched).includes(right);
            return (
              <div key={i}
                className={`match-item ${isMatched ? 'matched' : ''} ${selectedRight === right ? 'selected' : ''} ${wrongPair?.right === right ? 'wrong' : ''}`}
                onClick={() => !isMatched && setSelectedRight(right)}>
                {right}
              </div>
            );
          })}
        </div>
      </div>
      {Object.keys(matched).length === pairs.length && (
        <div style={{ marginTop: 14 }}>
          <div className="minigame-result">✓ Все пары найдены!</div>
          <button className="btn btn-primary" onClick={() => onComplete(100)}>Продолжить →</button>
        </div>
      )}
    </div>
  );
}

function ConceptGame({ data, onComplete }: { data: any; onComplete: (score: number) => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSelect = (idx: number) => {
    if (submitted) return;
    setSelected(idx);
    setSubmitted(true);
    const correct = data.data.options[idx].correct;
    setTimeout(() => onComplete(correct ? 100 : 30), 1500);
  };

  return (
    <div className="minigame-container">
      <div className="minigame-title">{data.title}</div>
      <div className="minigame-desc">{data.desc}</div>
      <div className="choice-question">{data.data.question}</div>
      <div className="choice-options">
        {data.data.options.map((opt: any, idx: number) => (
          <div key={idx}
            className={`choice-option ${submitted ? (idx === selected ? (opt.correct ? 'correct' : 'incorrect') : (opt.correct ? 'correct' : '')) : ''}`}
            onClick={() => handleSelect(idx)}>
            {opt.text}
          </div>
        ))}
      </div>
      {submitted && (
        <div style={{ marginTop: 14 }}>
          <button className="btn btn-primary" onClick={() => onComplete(data.data.options[selected!].correct ? 100 : 30)}>Продолжить →</button>
        </div>
      )}
    </div>
  );
}

function DistributionGame({ data, onComplete }: { data: any; onComplete: (score: number) => void }) {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  const handlePlace = (categoryName: string) => {
    if (!selectedItem || submitted) return;
    setPlacements(prev => ({ ...prev, [selectedItem]: categoryName }));
    setSelectedItem(null);
  };

  const checkAnswers = () => {
    setSubmitted(true);
    let correct = 0;
    data.data.categories.forEach((cat: any) => {
      data.data.allItems.forEach((item: string) => {
        if (placements[item] === cat.name && cat.items.includes(item)) correct++;
      });
    });
    setFinalScore(Math.round((correct / data.data.allItems.length) * 100));
  };

  const getCorrectCategory = (item: string): string => {
    for (const cat of data.data.categories) {
      if (cat.items.includes(item)) return cat.name;
    }
    return '';
  };

  return (
    <div className="minigame-container">
      <div className="minigame-title">{data.title}</div>
      <div className="minigame-desc">{data.desc}</div>
      <div className="dist-pool">
        {data.data.allItems.map((item: string) => (
          <div key={item}
            className={`dist-pool-item ${placements[item] ? 'used' : ''} ${selectedItem === item ? 'selected' : ''}`}
            onClick={() => !placements[item] && setSelectedItem(item === selectedItem ? null : item)}>
            {item}
          </div>
        ))}
      </div>
      <div className="dist-categories">
        {data.data.categories.map((cat: any) => (
          <div key={cat.name} className="dist-category">
            <div className="dist-category-title">{cat.name}</div>
            <div className="dist-items" onClick={() => handlePlace(cat.name)}>
              {data.data.allItems.filter((item: string) => placements[item] === cat.name).map((item: string) => {
                const isCorrect = cat.items.includes(item);
                return (
                  <div key={item} className={`dist-item ${submitted ? (isCorrect ? 'placed' : 'wrong') : ''}`}>
                    {item} {submitted && !isCorrect && <span style={{ color: 'var(--error)', fontSize: '0.7rem' }}> ← {getCorrectCategory(item)}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {!submitted ? (
        <div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginBottom: 8 }}>
            Размещено: {Object.keys(placements).length} из {data.data.allItems.length}
          </p>
          <button className="btn btn-primary" onClick={checkAnswers}>Проверить</button>
        </div>
      ) : (
        <div>
          <div className="minigame-result">Результат: {finalScore}%</div>
          <button className="btn btn-primary" onClick={() => onComplete(finalScore!)}>Продолжить →</button>
        </div>
      )}
    </div>
  );
}

function TrueFalseGame({ data, onComplete }: { data: any; onComplete: (score: number) => void }) {
  const [answers, setAnswers] = useState<Record<number, boolean | null>>({});
  const [submitted, setSubmitted] = useState(false);
  const [finalScore, setFinalScore] = useState<number | null>(null);

  const setAnswer = (idx: number, val: boolean) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [idx]: val }));
  };

  const check = () => {
    setSubmitted(true);
    let correct = 0;
    data.data.forEach((s: any, i: number) => {
      if (answers[i] === s.truth) correct++;
    });
    setFinalScore(Math.round((correct / data.data.length) * 100));
  };

  return (
    <div className="minigame-container">
      <div className="minigame-title">{data.title}</div>
      <div className="minigame-desc">{data.desc}</div>
      {data.data.map((s: any, i: number) => (
        <div key={i} className="tf-item">
          <div>{s.text}</div>
          <div className="tf-buttons">
            <button className={`tf-btn ${answers[i] === true ? 'active-true' : ''}`} onClick={() => setAnswer(i, true)}>✓ Факт</button>
            <button className={`tf-btn ${answers[i] === false ? 'active-false' : ''}`} onClick={() => setAnswer(i, false)}>✗ Миф</button>
          </div>
          {submitted && (
            <div style={{ marginTop: 6, fontSize: '0.8rem', color: answers[i] === s.truth ? 'var(--success)' : 'var(--error)' }}>
              {answers[i] === s.truth ? '✓ Верно!' : `✗ Это ${s.truth ? 'факт' : 'миф'}.`} {s.explanation}
            </div>
          )}
        </div>
      ))}
      {!submitted ? (
        <button className="btn btn-primary" onClick={check} disabled={Object.keys(answers).length < data.data.length}>Проверить</button>
      ) : (
        <div>
          <div className="minigame-result">Результат: {finalScore}%</div>
          <button className="btn btn-primary" onClick={() => onComplete(finalScore!)}>Продолжить →</button>
        </div>
      )}
    </div>
  );
}

// ===== DIAGNOSIS =====

function DiagnosisScreen({ stationScores, miniGameScores, totalScore, grade, errors, onRestart }: {
  stationScores: Record<string, number>;
  miniGameScores: Record<string, number>;
  totalScore: number;
  grade: string;
  errors: string[];
  onRestart: () => void;
}) {
  const stationLabels = ['§1', '§2', 'Сословия/абсолютизм', 'Повседневность/войны', '§11–13', '§16', '§17–18', '§19–20', '§21–22'];
  const stationIds = stations.map(s => s.id);
  const scores = stationIds.map(id => stationScores[id] || 0);

  const recommendations: string[] = [];
  stations.forEach((s, idx) => {
    const score = stationScores[s.id] || 0;
    if (score < 70) {
      let ref = s.paragraphs;
      if (['A3', 'A4'].includes(s.id)) ref = `тема «${s.topic}»`;
      recommendations.push(`Станция ${s.number} (${ref}): ${s.title} — результат ${score}%. Перечитать ${s.paragraphs}.`);
    }
  });

  const allConcepts = stations.flatMap(s => s.summary.concepts.map(c => c.term));
  const masteredCount = Math.round((totalScore / 100) * allConcepts.length);

  return (
    <div className="app-container">
      <Header title="Итоги повторения" progress="Завершено" />
      <div className="main-content diagnosis-screen">
        <div className="diagnosis-header">
          <h2>📊 Итоги повторения</h2>
          <p>Век Просвещения + Французская революция и наполеоновская эпоха</p>
        </div>

        <div className="diagnosis-chart">
          <h3>Результаты по станциям</h3>
          <div className="chart-container">
            <svg width="100%" height="240" viewBox="0 0 700 240" preserveAspectRatio="xMidYMid meet">
              {scores.map((score, i) => {
                const barWidth = 50;
                const gap = (700 - barWidth * 9) / 10;
                const x = gap + i * (barWidth + gap);
                const barHeight = (score / 100) * 170;
                const y = 190 - barHeight;
                const color = score >= 85 ? '#2e7d32' : score >= 70 ? '#1565c0' : score >= 50 ? '#f57f17' : '#c62828';
                return (
                  <g key={i}>
                    <rect x={x} y={y} width={barWidth} height={barHeight} fill={color} rx="4" />
                    <text x={x + barWidth / 2} y={y - 5} textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>{score}%</text>
                    <text x={x + barWidth / 2} y={210} textAnchor="middle" fontSize="9" fill="#616161">{stationLabels[i]}</text>
                  </g>
                );
              })}
              <line x1="0" y1="190" x2="700" y2="190" stroke="#e0e0e0" strokeWidth="2" />
            </svg>
          </div>
        </div>

        <div className="diagnosis-grade">
          <p>Общий результат: <strong>{totalScore}%</strong></p>
          <div className={`grade-display grade-${grade}`}>{grade}</div>
          <p style={{ color: 'var(--text-light)' }}>
            {grade === '5' && 'Отлично! Вы прекрасно знаете материал.'}
            {grade === '4' && 'Хорошо! Есть небольшие пробелы.'}
            {grade === '3' && 'Удовлетворительно. Рекомендуется повторить отдельные темы.'}
            {grade === '2' && 'Нужно серьёзно повторить материал.'}
          </p>
        </div>

        {recommendations.length > 0 && (
          <div className="diagnosis-recommendations">
            <h3>📝 Рекомендации «что перечитать»</h3>
            {recommendations.map((r, i) => <div key={i} className="recommendation-item">{r}</div>)}
          </div>
        )}

        {errors.length > 0 && (
          <div className="diagnosis-recommendations">
            <h3>❌ Допущенные ошибки с разъяснениями</h3>
            {errors.slice(0, 10).map((e, i) => <div key={i} className="error-item">{e}</div>)}
          </div>
        )}

        <div className="concepts-mastered">
          <h3>📚 Понятия ({masteredCount} из {allConcepts.length} предположительно освоено)</h3>
          <div className="mastered-tags">
            {allConcepts.slice(0, Math.min(masteredCount, allConcepts.length)).map((c, i) => (
              <span key={i} className="mastered-tag yes">{c}</span>
            ))}
            {allConcepts.slice(masteredCount).map((c, i) => (
              <span key={i} className="mastered-tag no">{c}</span>
            ))}
          </div>
        </div>

        <div className="thread-conclusion">
          <h3>🔗 Сквозной вывод: от идей к «оружию разрушителей»</h3>
          <p>Идеи Просвещения (естественные права, общественный договор, разделение властей) были созданы мыслителями как программа <strong>реформ</strong>, а не революции. Вольтер, Дидро, Монтескьё жили при Старом порядке и имели покровителей-монархов.</p>
          <p>Но в 1789 году эти идеи стали <strong>программой революции</strong>: Декларация прав человека провозгласила то, о чём писали просветители. Третье сословие потребовало того, чего хотело столетие.</p>
          <p>Однако революция и империя <strong>«съели» эти идеи</strong>: террор Робеспьера превратил «свободу» в инструмент репрессий; Наполеон создал диктатуру с культом личности, плебисцитами и цензурой. Естественные права стали «оружием разрушителей» — сначала Старого порядка, а затем и самих революционных идеалов.</p>
        </div>

        <div className="nav-buttons">
          <button className="btn btn-primary" onClick={onRestart}>Пройти заново</button>
        </div>
      </div>
      <DownloadButton />
    </div>
  );
}

// ===== TEACHER PAGE =====

function TeacherScreen({ auth, password, setPassword, onAuth, tab, setTab, onBack }: {
  auth: boolean; password: string; setPassword: (p: string) => void;
  onAuth: () => void; tab: string; setTab: (t: 'journal' | 'keys' | 'aggregate') => void;
  onBack: () => void;
}) {
  if (!auth) {
    return (
      <div className="app-container">
        <Header title="Страница учителя" progress="" onBack={onBack} />
        <div className="main-content">
          <div className="teacher-login">
            <h2>🔐 Вход для учителя</h2>
            <input className="welcome-input" type="password" placeholder="Пароль"
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onAuth()} />
            <button className="btn btn-primary" onClick={onAuth}>Войти</button>
          </div>
        </div>
      </div>
    );
  }

  const results: StudentResult[] = JSON.parse(localStorage.getItem('historyQuest_results_v2') || '[]');

  const clearData = () => {
    if (confirm('Удалить все данные учеников?')) {
      localStorage.removeItem('historyQuest_results_v2');
      alert('Данные удалены');
    }
  };

  const exportCSV = () => {
    let csv = 'Имя;Класс;Время;';
    stations.forEach(s => csv += `${s.id};`);
    csv += 'Итого;Оценка\n';
    results.forEach(r => {
      csv += `${r.name};${r.class || ''};${new Date(r.startTime).toLocaleString()};`;
      stations.forEach(s => csv += `${r.stationScores[s.id] || 0}%;`);
      csv += `${r.totalScore}%;${r.grade}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'history_quest_results.csv'; a.click();
  };

  const exportTXT = () => {
    let txt = 'ЖУРНАЛ РЕЗУЛЬТАТОВ — Хранитель архива\n' + '='.repeat(50) + '\n\n';
    results.forEach(r => {
      txt += `Ученик: ${r.name}${r.class ? ` (${r.class})` : ''}\n`;
      txt += `Время: ${new Date(r.startTime).toLocaleString()}\n`;
      txt += `Станции: `;
      stations.forEach(s => txt += `${s.id}=${r.stationScores[s.id] || 0}% `);
      txt += `\nИтого: ${r.totalScore}%, Оценка: ${r.grade}\n`;
      if (r.comments) txt += `Комментарий: ${r.comments}\n`;
      txt += '-'.repeat(40) + '\n';
    });
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'history_quest_results.txt'; a.click();
  };

  const updateComment = (idx: number, comment: string) => {
    const updated = [...results];
    updated[idx].comments = comment;
    localStorage.setItem('historyQuest_results_v2', JSON.stringify(updated));
  };

  const toggleApproved = (idx: number) => {
    const updated = [...results];
    updated[idx].teacherApproved = !updated[idx].teacherApproved;
    localStorage.setItem('historyQuest_results_v2', JSON.stringify(updated));
  };

  // Aggregate
  const aggregate = stations.map(s => {
    const vals = results.map(r => r.stationScores[s.id] || 0).filter(v => v > 0);
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  });

  const gradeDistribution = { '5': 0, '4': 0, '3': 0, '2': 0 };
  results.forEach(r => { if (gradeDistribution[r.grade as keyof typeof gradeDistribution] !== undefined) gradeDistribution[r.grade as keyof typeof gradeDistribution]++; });

  return (
    <div className="app-container">
      <Header title="Страница учителя" progress={`${results.length} учеников`} onBack={onBack} />
      <div className="main-content teacher-screen">
        <div className="teacher-content">
          <div className="teacher-tabs">
            <div className={`teacher-tab ${tab === 'journal' ? 'active' : ''}`} onClick={() => setTab('journal')}>📋 Журнал</div>
            <div className={`teacher-tab ${tab === 'keys' ? 'active' : ''}`} onClick={() => setTab('keys')}>🔑 Ключи</div>
            <div className={`teacher-tab ${tab === 'aggregate' ? 'active' : ''}`} onClick={() => setTab('aggregate')}>📈 Агрегат</div>
          </div>

          {tab === 'journal' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <button className="btn btn-small btn-outline" onClick={exportCSV}>📥 Экспорт CSV</button>
                <button className="btn btn-small btn-outline" onClick={exportTXT}>📥 Экспорт TXT</button>
                <button className="btn btn-small btn-secondary" onClick={clearData}>🗑 Очистить данные</button>
              </div>
              {results.length === 0 && <p style={{ color: 'var(--text-light)' }}>Пока нет результатов.</p>}
              {results.map((r, idx) => (
                <div key={idx} className="student-card">
                  <div className="student-card-header">
                    <span className="student-name">{r.name}{r.class ? ` (${r.class})` : ''}</span>
                    <span className="student-time">{new Date(r.startTime).toLocaleString()}</span>
                  </div>
                  <div className="student-details">
                    {stations.map(s => `${s.id}=${r.stationScores[s.id] || 0}%`).join(' | ')}
                    <br />Итого: {r.totalScore}% → Оценка: <strong>{r.grade}</strong>
                    {r.teacherApproved && ' ✓ Проверено'}
                  </div>
                  <div className="teacher-comment">
                    <textarea placeholder="Комментарий ученику..." value={r.comments || ''}
                      onChange={e => updateComment(idx, e.target.value)} />
                    <button className="btn btn-small btn-outline" style={{ marginTop: 5 }} onClick={() => toggleApproved(idx)}>
                      {r.teacherApproved ? '✓ Проверено' : 'Отметить проверенным'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'keys' && (
            <div className="teacher-panel keys-section">
              <h3>🔑 Эталонные ответы</h3>
              {stations.map(s => (
                <div key={s.id}>
                  <h4>Станция {s.number} ({s.paragraphs}) — {s.title}</h4>
                  <p><strong>Вопрос:</strong> {(teacherKeys.stations as any)[s.id].question}</p>
                  <p><strong>Обоснование:</strong> {(teacherKeys.stations as any)[s.id].explanation}</p>
                  <p><strong>Источник:</strong> {(teacherKeys.stations as any)[s.id].ref}</p>
                </div>
              ))}
              <h4>Мини-игры</h4>
              {Object.entries(teacherKeys.miniGames).map(([key, val]) => (
                <p key={key}><strong>{key}:</strong> {val as string}</p>
              ))}
            </div>
          )}

          {tab === 'aggregate' && (
            <div className="teacher-panel">
              <h3>📈 Агрегат по классу</h3>
              {results.length === 0 && <p style={{ color: 'var(--text-light)' }}>Нет данных.</p>}
              {results.length > 0 && (
                <>
                  <p style={{ marginBottom: 10 }}>Всего учеников: <strong>{results.length}</strong></p>
                  <p style={{ marginBottom: 10 }}>Распределение по отметкам:
                    {Object.entries(gradeDistribution).map(([g, c]) => ` «${g}»=${c}`).join(',')}
                  </p>
                  <div className="class-aggregate">
                    {aggregate.map((val, i) => (
                      <div key={i} className="aggregate-bar">
                        <div className="aggregate-label">{stations[i].id} {stations[i].paragraphs}</div>
                        <div className="aggregate-fill">
                          <div className="aggregate-fill-inner" style={{
                            width: `${val}%`,
                            background: val >= 70 ? 'var(--success)' : val >= 50 ? 'var(--warning)' : 'var(--error)'
                          }} />
                        </div>
                        <div className="aggregate-value">{val}%</div>
                      </div>
                    ))}
                  </div>
                  {aggregate.some(v => v > 0 && v < 70) && (
                    <div style={{ marginTop: 14 }}>
                      <h4 style={{ color: 'var(--warning)' }}>⚠️ Проседающие станции (топ-3):</h4>
                      {aggregate.map((val, i) => val > 0 && val < 70 && (
                        <div key={i} className="recommendation-item">
                          Станция {stations[i].number} ({stations[i].paragraphs}): {stations[i].title} — средний {val}%
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== DOWNLOAD BUTTON =====

function DownloadButton() {
  const handleDownload = () => {
    const html = document.documentElement.outerHTML;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'history_quest_archive.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button className="download-btn" onClick={handleDownload}>
      💾 Скачать игру
    </button>
  );
}

export default App;
