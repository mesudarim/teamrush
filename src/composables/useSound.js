import wrongAnswerSrc  from '@/assets/wrongAnswer.mp3'
import correctAnswerSrc from '@/assets/correctAnwer.mp3'
import endOfGameSrc    from '@/assets/endOfGame.mp3'

const make = (src) => {
  const audio = new Audio(src)
  audio.preload = 'auto'
  return audio
}

const sounds = {
  wrong:   make(wrongAnswerSrc),
  correct: make(correctAnswerSrc),
  end:     make(endOfGameSrc),
}

const play = (key) => {
  const s = sounds[key]
  if (!s) return
  s.currentTime = 0
  s.play().catch(() => {})   // ignore autoplay policy errors
}

export const useSound = () => ({
  playWrong:     () => play('wrong'),
  playCorrect:   () => play('correct'),
  playEndOfGame: () => play('end'),
})
