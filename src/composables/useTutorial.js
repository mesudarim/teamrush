/**
 * Tutorial steps per game phase.
 * Each step: { he, en, arrow: 'up'|'down'|null }
 *   arrow:'up'   → card at bottom, triangle pointing UP   (element is in upper half)
 *   arrow:'down' → card at top,    triangle pointing DOWN (element is in lower half)
 *   arrow: null  → card centered, no triangle
 */
const STEPS = {
  envelope1: [
    {
      he: 'ברוכים הבאים לנקודה! לפניכם מעטפה כחולה.',
      en: 'Welcome to the checkpoint! You see a blue envelope.',
      arrow: 'up',
    },
    {
      he: 'לחצו על המעטפה כדי לגלות לאן אתם צריכים ללכת.',
      en: 'Tap the envelope to discover your next destination.',
      arrow: 'up',
    },
  ],

  stage1: [
    {
      he: 'הגעתם למקום! עכשיו חפשו את מילת הקוד הסודית שנמצאת כאן.',
      en: 'You made it! Now look around for the secret keyword hidden here.',
      arrow: null,
    },
    {
      he: 'הקלידו את המילה שמצאתם בשדה הטקסט ולחצו אישור.',
      en: 'Type the keyword you found in the text field and confirm.',
      arrow: 'down',
    },
  ],

  bravo: [
    {
      he: 'כל הכבוד! מצאתם את מילת הקוד הנכונה!',
      en: 'Well done! You found the correct keyword!',
      arrow: 'up',
    },
    {
      he: 'לחצו על הכפתור כדי להמשיך למשימה המלאה של הנקודה.',
      en: 'Tap the button to continue to the full mission.',
      arrow: 'down',
    },
  ],

  envelope2: [
    {
      he: 'שלב שני! לפניכם מעטפה נוספת עם המשימה המלאה.',
      en: 'Stage 2! Another envelope with the full mission inside.',
      arrow: 'up',
    },
    {
      he: 'לחצו על המעטפה כדי לפתוח ולקרוא את המשימה.',
      en: 'Tap the envelope to open it and read your mission.',
      arrow: 'up',
    },
  ],

  stage2: [
    {
      he: 'זוהי המשימה שלכם – קראו בעיון ותענו על השאלה כדי לקבל נקודות.',
      en: 'This is your mission – read carefully and answer to score points.',
      arrow: 'up',
    },
    {
      he: 'תשובה נכונה = נקודות. תשובה שגויה = מינוס נקודה. אפשר לדלג אבל זה עולה 30 נקודות.',
      en: 'Correct = points. Wrong = −1 point. You can skip but it costs 30 points.',
      arrow: null,
    },
  ],

  result: [
    {
      he: 'הנה הניקוד שלכם לנקודת הביקורת הזו.',
      en: 'Here is your score for this checkpoint.',
      arrow: 'up',
    },
    {
      he: 'לחצו על הכפתור כדי לעבור לנקודה הבאה!',
      en: 'Tap the button to move on to the next checkpoint!',
      arrow: 'down',
    },
  ],

  tapis: [
    {
      he: 'כמעט סיימתם! הגעתם לנקודת הסיום של היום.',
      en: 'Almost done! You reached the final checkpoint of the day.',
      arrow: null,
    },
    {
      he: 'לחצו על כפתור הסריקה ופנו את המצלמה לקוד ה-QR שנמצא על הטאפיס.',
      en: 'Tap the scan button and point your camera at the QR code on the carpet.',
      arrow: 'down',
    },
  ],

  day1complete: [
    {
      he: 'מעולה! סיימתם את יום 1 בהצלחה. כאן תוכלו לראות את הניקוד שלכם.',
      en: 'Amazing! You completed Day 1. Here you can see your score.',
      arrow: 'up',
    },
    {
      he: 'כעת צאו ליהנות – יום 2 ייפתח בהמשך על ידי המנהל.',
      en: 'Now go enjoy – Day 2 will be activated later by the organiser.',
      arrow: null,
    },
  ],

  finished: [
    {
      he: 'כל הכבוד! סיימתם את כל המשחק.',
      en: 'Congratulations! You completed the entire game.',
      arrow: 'up',
    },
    {
      he: 'לחצו על לוח התוצאות כדי לראות את דירוג הקבוצות.',
      en: 'Tap the leaderboard button to see the team rankings.',
      arrow: 'down',
    },
  ],
}

export function useTutorial() {
  const getSteps = (phase) => STEPS[phase] ?? []
  return { getSteps }
}
