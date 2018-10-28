const { isEmpty } = require('lodash/fp')
const ora = require('ora')
const { bold } = require('chalk')
const { Processor } = require('../processor')
const { info, error } = require('../utils/log')

class Runner {
  constructor({ finder, parser, args, open }) {
    this.headless = !open
    this.args = args
    this.finder = finder
    this.parser = parser
    this.loader = ora({
      text: 'Running stories...',
      color: 'green',
      spinner: 'line',
      interval: 75,
    })
    this.history = {
      passed: 0,
      failed: {},
    }
  }

  updateLoaderText() {
    const { passed, failed } = this.history

    this.loader.text = `Running stories (${passed} passed, ${
      Object.keys(failed).length
    } failed).`
  }

  createLog() {
    Object.keys(this.history.failed).forEach(key => {
      const { def, message } = this.history.failed[key]

      error('---')
      error(`${bold('Story')}: ${key}`)
      error(`${bold('Action')}: ${def}`)
      error(`${bold('Error')}: ${message}`)
    })
  }

  async getStories(storiesPaths = []) {
    const rawStories = !isEmpty(storiesPaths)
      ? await this.finder.getStoriesByPaths(storiesPaths)
      : await this.finder.getStories()
    const parsedStories = this.parser.parseStories(rawStories) /* ? */

    return parsedStories
  }

  async processStory(story) {
    const storyProcessor = new Processor({
      headless: this.headless,
      args: this.args,
      story,
    })

    await storyProcessor.run()
  }

  async processStories(stories) {
    for (const story of stories) {
      try {
        await this.processStory(story)
        this.history.passed += 1
      } catch (err) {
        this.history.failed[story.name] = err
      } finally {
        this.updateLoaderText()
      }
    }
  }

  async run(storiesPaths) {
    const stories = await this.getStories(storiesPaths)

    this.loader.start()
    await this.processStories(stories)
    this.loader.stop()

    const { passed, failed } = this.history
    const hasError = Object.keys(failed).length > 0

    if (hasError) {
      error(
        `${passed} passed, ${
          Object.keys(failed).length
        } failed. Done with errors, see log below.`
      )
      this.createLog()
    } else {
      // TODO: create method for outputing
      // TODO: add skipped
      info(`${passed} passed, ${Object.keys(failed).length} failed. Done.`)
    }

    process.exit()
  }
}

module.exports = {
  Runner,
}
