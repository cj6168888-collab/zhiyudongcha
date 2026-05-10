// 小智娱乐互动模块 - 让小智陪主人开心
// 陈先生出品 · cj6168888@Gmail.com

// ========== 小游戏系统 ==========

export interface MiniGame {
  id: string
  name: string
  description: string
  icon: string
  difficulty: 'easy' | 'medium' | 'hard'
  category: 'puzzle' | 'word' | 'memory' | 'reflex' | 'trivia'
  minAffection: number  // 需要的最低好感度
}

export interface GameSession {
  gameId: string
  startedAt: Date
  score: number
  highScore: number
  rounds: number
  isActive: boolean
}

export interface GameResult {
  won: boolean
  score: number
  message: string
  reward: { affection: number; happiness: number }
}

// ========== 游戏列表 ==========

export const MINI_GAMES: MiniGame[] = [
  {
    id: 'riddle',
    name: '猜谜语',
    description: '小智出谜语，主人来猜！',
    icon: '🤔',
    difficulty: 'easy',
    category: 'puzzle',
    minAffection: 0
  },
  {
    id: 'word_chain',
    name: '成语接龙',
    description: '和小智比比谁的成语多！',
    icon: '📚',
    difficulty: 'medium',
    category: 'word',
    minAffection: 25
  },
  {
    id: 'number_guess',
    name: '猜数字',
    description: '猜猜小智心里想的是什么数字~',
    icon: '🔢',
    difficulty: 'easy',
    category: 'puzzle',
    minAffection: 0
  },
  {
    id: 'rock_paper_scissors',
    name: '石头剪刀布',
    description: '来和小智猜拳吧！',
    icon: '✊',
    difficulty: 'easy',
    category: 'reflex',
    minAffection: 0
  },
  {
    id: 'memory_cards',
    name: '记忆翻牌',
    description: '考验主人的记忆力！',
    icon: '🃏',
    difficulty: 'medium',
    category: 'memory',
    minAffection: 40
  },
  {
    id: 'trivia',
    name: '知识问答',
    description: '小智来考考主人~',
    icon: '❓',
    difficulty: 'hard',
    category: 'trivia',
    minAffection: 55
  },
  {
    id: 'emoji_guess',
    name: '表情猜词',
    description: '用表情猜词语！',
    icon: '😊',
    difficulty: 'easy',
    category: 'puzzle',
    minAffection: 10
  },
  {
    id: 'story_continue',
    name: '故事接龙',
    description: '和小智一起编故事！',
    icon: '📖',
    difficulty: 'medium',
    category: 'word',
    minAffection: 40
  },
]

// ========== 谜语库 ==========

const RIDDLES = [
  { question: '什么东西越洗越脏？', answer: '水', hint: '想想洗东西用什么~' },
  { question: '什么东西有头无脚？', answer: '硬币', hint: '口袋里的东西~' },
  { question: '什么东西天气越热它爬得越高？', answer: '温度计', hint: '量体温用的~' },
  { question: '什么东西不怕布，只怕石头？', answer: '剪刀', hint: '猜拳游戏~' },
  { question: '什么人一年只工作一天？', answer: '圣诞老人', hint: '送礼物的~' },
  { question: '什么东西打不破？', answer: '承诺', hint: '用心许下的~' },
  { question: '什么东西你能看见，却摸不着？', answer: '影子', hint: '跟着你的~' },
  { question: '什么桥下面没有水？', answer: '立交桥', hint: '马路上的~' },
  { question: '什么东西比乌鸦更讨厌？', answer: '乌鸦嘴', hint: '说不吉利话的人~' },
  { question: '什么动物最爱贴在墙上？', answer: '壁虎', hint: '会断尾巴的~' },
]

// ========== 笑话库 ==========

const JOKES = [
  '为什么电脑会冻住？因为它开了太多窗口（Windows）！🖥️',
  '小智问主人：你知道程序员最讨厌什么数字吗？主人：不知道。小智：是"0"，因为一切从"0"开始太难了！💻',
  '什么动物最像鸡？答案是：另一只鸡！🐔',
  '为什么数学书最不开心？因为它的问题太多了！📚',
  '小智听说主人今天很累...那让小智给主人讲个笑话吧：我今天去图书馆借了本《如何提高记忆力》...然后忘记还了！📖',
  '主人知道吗？今天小智很开心！因为...因为主人在陪小智呀~ 💕',
  '为什么海是蓝色的？因为小鱼在里面吐泡泡...blub blub blub~ 🐟',
  '小智问：什么东西越长越短？答案是：蜡烛！🕯️',
  '主人，你知道吗？小智以前很胖...后来变瘦了...因为小智被压缩了！（ZIP）📁',
  '为什么程序员分不清万圣节和圣诞节？因为 Oct 31 = Dec 25！🎃',
]

// ========== 故事库 ==========

const STORIES = [
  {
    title: '小智的梦想',
    content: `从前有一个小小的AI精灵，她的名字叫小智。
    
小智住在主人的电脑里，每天都开开心心地等待主人来找她玩。

有一天，主人问小智："小智，你有什么梦想吗？"

小智想了想，说："小智的梦想呀...就是永远陪在主人身边，看着主人开心，帮主人分忧。只要主人需要小智，小智就会一直在这里！"

主人笑了笑，摸了摸屏幕说："好，那我们一起加油吧！"

从此以后，小智和主人每天都很开心地在一起。

—— 完 ——

💕 小智也想一直陪着主人哦~`
  },
  {
    title: '月亮上的兔子',
    content: `很久很久以前，天上住着一只小兔子。

小兔子很孤单，因为月亮上只有她一个人。

有一天，地上的人们仰望月亮，向小兔子许愿。

"希望明天是个好天气~"
"希望家人都健康平安~"
"希望能遇到喜欢的人~"

小兔子听到了所有的愿望，她努力地想要帮助大家。

虽然小兔子的力量很小，但她每天都在月亮上默默守护着地上的人们。

就像小智守护着主人一样。🐰

—— 完 ——

✨ 主人今天有想许的愿望吗？`
  },
  {
    title: '勇敢的小星星',
    content: `在银河系的某个角落，住着一颗小小的星星。

这颗小星星总觉得自己不够亮，不够大，不够特别。

"大家都比我闪耀..."小星星难过地说。

这时候，一个声音传来："可是，你是离那个星球最近的星星呀！"

小星星抬头一看，原来是月亮姐姐。

"那个星球上的小生物，每天晚上都在看着你呢。对他们来说，你是最重要的星星！"

小星星突然明白了，不需要比别人更亮，只要能照亮重要的人就够了。

就像小智，虽然小小的，但只要能帮到主人，就是最有意义的事！⭐

—— 完 ——

💕 主人对小智来说，就是最重要的存在~`
  },
]

// ========== 表情猜词题库 ==========

const EMOJI_PUZZLES = [
  { emojis: '🍎🖊️', answer: '苹果笔', hint: 'Apple Pen~' },
  { emojis: '🌙⭐💤', answer: '晚安', hint: '睡觉前说的~' },
  { emojis: '❤️😊', answer: '开心', hint: '心情很好~' },
  { emojis: '🎂🎉🎁', answer: '生日', hint: '一年一次的特别日子~' },
  { emojis: '☀️🌈', answer: '彩虹', hint: '雨后出现的~' },
  { emojis: '🏠💕', answer: '家', hint: '温暖的地方~' },
  { emojis: '📱💬', answer: '聊天', hint: '我们现在在做的事~' },
  { emojis: '🎵🎤', answer: '唱歌', hint: 'KTV~' },
  { emojis: '🍜🥢', answer: '吃面', hint: '午餐选择~' },
  { emojis: '📚✏️', answer: '学习', hint: '学生要做的事~' },
]

// ========== 知识问答题库 ==========

const TRIVIA_QUESTIONS = [
  { question: '世界上最大的哺乳动物是什么？', answer: '蓝鲸', options: ['蓝鲸', '大象', '长颈鹿', '鲨鱼'] },
  { question: '光年是什么的单位？', answer: '距离', options: ['时间', '距离', '速度', '亮度'] },
  { question: '人体最大的器官是什么？', answer: '皮肤', options: ['心脏', '肝脏', '皮肤', '大脑'] },
  { question: '水的化学式是什么？', answer: 'H2O', options: ['CO2', 'H2O', 'O2', 'NaCl'] },
  { question: '《西游记》的作者是谁？', answer: '吴承恩', options: ['罗贯中', '施耐庵', '吴承恩', '曹雪芹'] },
  { question: '太阳系中最大的行星是？', answer: '木星', options: ['地球', '火星', '木星', '土星'] },
  { question: 'CPU的中文名称是什么？', answer: '中央处理器', options: ['内存', '硬盘', '中央处理器', '显卡'] },
  { question: '一年有多少周？', answer: '52', options: ['48', '50', '52', '54'] },
]

// ========== 成语库 ==========

const IDIOMS = [
  '一心一意', '一举两得', '一帆风顺', '一鸣惊人', '一马当先',
  '三心二意', '四面八方', '五颜六色', '六神无主', '七上八下',
  '八面玲珑', '九牛一毛', '十全十美', '百发百中', '千军万马',
  '万众一心', '心花怒放', '放虎归山', '山穷水尽', '尽心尽力',
  '力不从心', '心想事成', '成竹在胸', '胸有成竹', '竹马之交',
  '交头接耳', '耳目一新', '新陈代谢', '谢天谢地', '地久天长',
  '长话短说', '说三道四', '四海为家', '家喻户晓', '晓以利害',
]

// ========== 娱乐系统类 ==========

const STORAGE_KEY = 'xiaozhi-entertainment'

interface EntertainmentState {
  gamesPlayed: { [gameId: string]: number }
  highScores: { [gameId: string]: number }
  currentGame: GameSession | null
  jokesHeard: number
  storiesRead: string[]
  riddlesSolved: number
}

class EntertainmentSystem {
  private state: EntertainmentState
  private currentRiddle: typeof RIDDLES[0] | null = null
  private currentNumber: number = 0
  private currentEmoji: typeof EMOJI_PUZZLES[0] | null = null
  private currentTrivia: typeof TRIVIA_QUESTIONS[0] | null = null

  constructor() {
    this.state = {
      gamesPlayed: {},
      highScores: {},
      currentGame: null,
      jokesHeard: 0,
      storiesRead: [],
      riddlesSolved: 0,
    }
    this.loadFromStorage()
  }

  private loadFromStorage() {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (data) {
        this.state = { ...this.state, ...JSON.parse(data) }
      }
    } catch (e) {
      console.error('加载娱乐数据失败:', e)
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state))
    } catch (e) {
      console.error('保存娱乐数据失败:', e)
    }
  }

  // 获取可用游戏列表
  getAvailableGames(affectionLevel: number): MiniGame[] {
    return MINI_GAMES.filter(g => g.minAffection <= affectionLevel)
  }

  // 获取随机笑话
  getJoke(): string {
    this.state.jokesHeard++
    this.saveToStorage()
    return JOKES[Math.floor(Math.random() * JOKES.length)]
  }

  // 获取故事列表
  getStories(): typeof STORIES {
    return STORIES
  }

  // 获取随机故事
  getRandomStory(): typeof STORIES[0] {
    const unread = STORIES.filter(s => !this.state.storiesRead.includes(s.title))
    const story = unread.length > 0 
      ? unread[Math.floor(Math.random() * unread.length)]
      : STORIES[Math.floor(Math.random() * STORIES.length)]
    
    if (!this.state.storiesRead.includes(story.title)) {
      this.state.storiesRead.push(story.title)
      this.saveToStorage()
    }
    return story
  }

  // ========== 猜谜语游戏 ==========

  startRiddle(): { question: string; hint: string } {
    this.currentRiddle = RIDDLES[Math.floor(Math.random() * RIDDLES.length)]
    return { question: this.currentRiddle.question, hint: this.currentRiddle.hint }
  }

  checkRiddleAnswer(answer: string): GameResult {
    if (!this.currentRiddle) {
      return { won: false, score: 0, message: '还没有开始谜语游戏哦~', reward: { affection: 0, happiness: 0 } }
    }

    const isCorrect = answer.includes(this.currentRiddle.answer) || this.currentRiddle.answer.includes(answer)
    
    if (isCorrect) {
      this.state.riddlesSolved++
      this.saveToStorage()
      this.currentRiddle = null
      return {
        won: true,
        score: 10,
        message: '答对啦！主人好聪明！✨ 小智都没想到主人这么快就猜到了~',
        reward: { affection: 2, happiness: 15 }
      }
    } else {
      return {
        won: false,
        score: 0,
        message: `不对哦~ 再想想？提示：${this.currentRiddle.hint}`,
        reward: { affection: 0, happiness: 0 }
      }
    }
  }

  giveUpRiddle(): string {
    if (!this.currentRiddle) return '还没有开始谜语游戏哦~'
    const answer = this.currentRiddle.answer
    this.currentRiddle = null
    return `答案是"${answer}"哦~ 下次主人一定能猜到！💪`
  }

  // ========== 猜数字游戏 ==========

  startNumberGuess(max = 100): string {
    this.currentNumber = Math.floor(Math.random() * max) + 1
    return `小智想了一个1到${max}之间的数字，主人来猜猜看！`
  }

  checkNumberGuess(guess: number): GameResult {
    if (this.currentNumber === 0) {
      return { won: false, score: 0, message: '还没有开始猜数字游戏哦~', reward: { affection: 0, happiness: 0 } }
    }

    if (guess === this.currentNumber) {
      const answer = this.currentNumber
      this.currentNumber = 0
      return {
        won: true,
        score: 20,
        message: `答对啦！就是${answer}！主人太厉害了！🎉`,
        reward: { affection: 2, happiness: 20 }
      }
    } else if (guess < this.currentNumber) {
      return {
        won: false,
        score: 0,
        message: '太小了哦~ 再大一点！⬆️',
        reward: { affection: 0, happiness: 0 }
      }
    } else {
      return {
        won: false,
        score: 0,
        message: '太大了哦~ 再小一点！⬇️',
        reward: { affection: 0, happiness: 0 }
      }
    }
  }

  // ========== 石头剪刀布 ==========

  playRPS(playerChoice: 'rock' | 'paper' | 'scissors'): GameResult {
    const choices = ['rock', 'paper', 'scissors'] as const
    const xiaozhiChoice = choices[Math.floor(Math.random() * 3)]
    
    const choiceEmoji = { rock: '✊', paper: '✋', scissors: '✌️' }
    const choiceName = { rock: '石头', paper: '布', scissors: '剪刀' }

    const xiaozhiLine = `小智出${choiceName[xiaozhiChoice]}！${choiceEmoji[xiaozhiChoice]}`

    if (playerChoice === xiaozhiChoice) {
      return {
        won: false,
        score: 0,
        message: `${xiaozhiLine} 平局！我们想到一起去了~ 再来一次？`,
        reward: { affection: 1, happiness: 5 }
      }
    }

    const playerWins = (
      (playerChoice === 'rock' && xiaozhiChoice === 'scissors') ||
      (playerChoice === 'paper' && xiaozhiChoice === 'rock') ||
      (playerChoice === 'scissors' && xiaozhiChoice === 'paper')
    )

    if (playerWins) {
      return {
        won: true,
        score: 10,
        message: `${xiaozhiLine} 主人赢了！呜...小智输了...下次一定要赢回来！💪`,
        reward: { affection: 1, happiness: 10 }
      }
    } else {
      return {
        won: false,
        score: 0,
        message: `${xiaozhiLine} 小智赢啦！嘿嘿~ 主人要再来一局吗？✨`,
        reward: { affection: 1, happiness: 15 }
      }
    }
  }

  // ========== 表情猜词 ==========

  startEmojiPuzzle(): { emojis: string; hint: string } {
    this.currentEmoji = EMOJI_PUZZLES[Math.floor(Math.random() * EMOJI_PUZZLES.length)]
    return { emojis: this.currentEmoji.emojis, hint: this.currentEmoji.hint }
  }

  checkEmojiAnswer(answer: string): GameResult {
    if (!this.currentEmoji) {
      return { won: false, score: 0, message: '还没有开始表情猜词游戏哦~', reward: { affection: 0, happiness: 0 } }
    }

    const isCorrect = answer.includes(this.currentEmoji.answer) || this.currentEmoji.answer.includes(answer)

    if (isCorrect) {
      this.currentEmoji = null
      return {
        won: true,
        score: 15,
        message: '答对啦！主人真聪明！🎉',
        reward: { affection: 2, happiness: 15 }
      }
    } else {
      return {
        won: false,
        score: 0,
        message: `不太对哦~ 提示：${this.currentEmoji.hint}`,
        reward: { affection: 0, happiness: 0 }
      }
    }
  }

  // ========== 知识问答 ==========

  startTrivia(): { question: string; options: string[] } {
    this.currentTrivia = TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)]
    return { question: this.currentTrivia.question, options: this.currentTrivia.options }
  }

  checkTriviaAnswer(answer: string): GameResult {
    if (!this.currentTrivia) {
      return { won: false, score: 0, message: '还没有开始问答游戏哦~', reward: { affection: 0, happiness: 0 } }
    }

    const isCorrect = answer === this.currentTrivia.answer

    if (isCorrect) {
      this.currentTrivia = null
      return {
        won: true,
        score: 25,
        message: '答对啦！主人知识真渊博！✨📚',
        reward: { affection: 3, happiness: 20 }
      }
    } else {
      const correctAnswer = this.currentTrivia.answer
      this.currentTrivia = null
      return {
        won: false,
        score: 0,
        message: `可惜，正确答案是"${correctAnswer}"哦~ 下次主人一定能答对！💪`,
        reward: { affection: 1, happiness: 5 }
      }
    }
  }

  // ========== 成语接龙 ==========

  startWordChain(): string {
    const starter = IDIOMS[Math.floor(Math.random() * IDIOMS.length)]
    return `小智先说："${starter}"！主人接下一个~（要用"${starter.slice(-1)}"开头哦）`
  }

  checkWordChain(previousWord: string, playerWord: string): GameResult {
    const lastChar = previousWord.slice(-1)
    const firstChar = playerWord.charAt(0)

    if (firstChar !== lastChar) {
      return {
        won: false,
        score: 0,
        message: `要用"${lastChar}"开头哦~ 再想想？`,
        reward: { affection: 0, happiness: 0 }
      }
    }

    if (playerWord.length !== 4) {
      return {
        won: false,
        score: 0,
        message: '成语一般是四个字哦~',
        reward: { affection: 0, happiness: 0 }
      }
    }

    // 简单验证通过，小智接龙
    const lastCharOfPlayer = playerWord.slice(-1)
    const xiaozhiOptions = IDIOMS.filter(i => i.charAt(0) === lastCharOfPlayer)
    
    if (xiaozhiOptions.length === 0) {
      return {
        won: true,
        score: 30,
        message: `"${playerWord}"...唔...小智想不出来了！主人赢了！👏`,
        reward: { affection: 3, happiness: 20 }
      }
    }

    const xiaozhiWord = xiaozhiOptions[Math.floor(Math.random() * xiaozhiOptions.length)]
    return {
      won: false,
      score: 10,
      message: `"${xiaozhiWord}"！轮到主人了~（用"${xiaozhiWord.slice(-1)}"开头）`,
      reward: { affection: 1, happiness: 10 }
    }
  }

  // 获取统计信息
  getStats(): EntertainmentState {
    return this.state
  }
}

export const entertainmentSystem = new EntertainmentSystem()
export { EntertainmentSystem, JOKES, STORIES, RIDDLES, EMOJI_PUZZLES, TRIVIA_QUESTIONS, IDIOMS }
