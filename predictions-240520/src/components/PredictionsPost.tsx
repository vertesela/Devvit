import { Devvit, Context } from '@devvit/public-api';
import { Service } from '../service/Service.js';

// Components
import { Header } from './Header.js';
import { WagerModal } from './WagerModal.js';
import { IntroductionModal } from './IntroductionModal.js';
import { Questions } from './Questions.js';
import { Scoreboard } from './Scoreboard.js';
import { Options } from './Options.js';
import { Tabs } from './Tabs.js';

// Data and Utils
import { clamp } from '../utils/clamp.js';
import { getThemedColors } from '../utils/getThemedColors.js';

// Types
import { Pages } from '../types/Pages.js';
import { Modals } from '../types/Modals.js';
import { Option } from '../types/Option.js';
import { AppContent } from '../types/AppContent.js';

export default function PredictionsPost(context: Context) {
  const { ui, useState, useForm, postId, userId, reddit, scheduler } = context;
  const [option, setOption] = useState<Option | undefined>(undefined);

  const [offset, setOffset] = useState<number>(0);
  const [page, setPage] = useState<Pages>(Pages.OPTIONS);
  const [modal, setModal] = useState<Modals | undefined>(undefined);

  const [isModerator] = useState(async () => {
    const subreddit = await reddit.getCurrentSubreddit();
    const user = await reddit.getCurrentUser();
    const perms = await user.getModPermissionsForSubreddit(subreddit.name);
    return perms.includes('all');
  });

  const service = new Service(context);

  // Post data and stats
  const [appContent] = useState<AppContent | undefined>(
    async () =>
      await service.getAppContent({
        postId: postId!,
        userId: userId,
      })
  );
  const [tokens, setTokens] = useState<number>(appContent?.post?.tokens || 0);
  const [totalVotes, setTotalVotes] = useState<number>(
    appContent?.post?.votes || 0
  );

  // Options
  const [options, setOptions] = useState<Option[]>(
    appContent?.post.options || []
  );
  const [correctOption, setCorrectOption] = useState(
    appContent?.post.correctOption || null
  );

  // Settings
  const themedColor = getThemedColors(appContent?.settings.theme || 'unicorn');

  // User stats
  const [hasPredicted, setHasPredicted] = useState(
    appContent?.user.hasPredicted || false
  );

  // Wager
  const defaultWager = (appContent?.user?.score ?? 0) > 25 ? 25 : 0;
  const [wager, setWager] = useState(defaultWager);

  const wagerChangeHandler = (value: number) => {
    const min = 0;
    const max = appContent?.user?.score || 0;
    setWager(clamp(value, min, max));
  };

  if (!postId || !userId || !appContent) return null;

  const setSpecificWagerForm = useForm(
    (_data) => {
      return {
        fields: [
          {
            type: 'number',
            name: 'wager',
            label: 'Wager',
            min: 0,
            max: appContent.user?.score || 0,
            defaultValue: wager,
          },
        ],
        title: 'Set wager',
        acceptLabel: 'Confirm',
        cancelLabel: 'Cancel',
      };
    },
    async (event) => {
      wagerChangeHandler(event.wager);
      ui.showToast({ text: 'Set wager' });
    }
  );

  // Double confirmation form for when a moderators attempts to resolve the prediction
  const resolveConfirmationForm = useForm(
    (data) => {
      return {
        fields: [
          {
            type: 'string',
            name: 'outcome',
            label: 'Outcome',
            defaultValue: data.label ?? '',
            disabled: true,
          },
          {
            type: 'string',
            name: 'id',
            label: 'id',
            defaultValue: data.id ?? '',
            disabled: true,
          },
        ],
        title: 'Confirm outcome',
        description:
          'Please confirm that this is the correct outcome as this action is irreversible. Upon confirmation, all tokens are distributed to the winners.',
        acceptLabel: 'Confirm',
        cancelLabel: 'Cancel',
      };
    },
    async (event) => {
      await scheduler.runJob({
        name: 'ResolvePredictionTask',
        data: {
          postId: postId,
          optionId: event.id,
          tournamentId: appContent.post.tournamentId,
        },
        runAt: new Date(),
      });

      setCorrectOption(event.id);
      ui.showToast({ text: 'Thanks for resolving!' });
    }
  );

  const isEnded =
    appContent.post.ended === true || appContent.post.ends < Date.now();
  const isResolved = correctOption !== null;
  const seenIntro = appContent.user.seenIntro ?? false;

  const handleOptionPress = (option: Option) => {
    if (!isEnded && !hasPredicted) {
      setOption(option);

      if (seenIntro) {
        setModal(Modals.WAGER);
        return;
      }
      setModal(Modals.INTRODUCTION);
      return;
    }

    if (isEnded && isModerator && !isResolved) {
      ui.showForm(resolveConfirmationForm, option);
    }
  };

  const handlePageChange = (nextPage?: Pages) => {
    setOffset(0);
    setWager(defaultWager);

    if (nextPage) {
      setPage(nextPage);
      return;
    }

    if (page === Pages.OPTIONS) {
      setPage(Pages.QUESTIONS);
      return;
    }

    setPage(Pages.OPTIONS);
  };

  const handlePredictionSubmit = async () => {
    if (!option) return;

    await service.event.submitPrediction({
      postId,
      userId,
      optionId: option.id,
      tokens: wager,
      tournamentId: appContent.post.tournamentId,
      tournamentTokenDefault: appContent.tournament.tokens,
    });

    setHasPredicted(true);
    setModal(undefined);
    setOption(undefined);
    setTokens((prev) => prev + wager);
    setTotalVotes((prev) => prev + 1);
    setWager(defaultWager);
    setOptions((prev) =>
      prev.map((o) => {
        if (o.id === option.id) {
          return {
            ...o,
            votes: o.votes + 1,
          };
        }
        return o;
      })
    );
    ui.showToast({ text: 'Prediction submitted!' });
  };

  const isExpanded = page !== Pages.OPTIONS;

  // Tournament question processing and filtering
  // TODO: Omit the current post from the list of questions. Or maybe I just indicate it somehow as selected.

  const questions = appContent.tournament.questions ?? [];

  // create a const "sortedQuestions" and shot all the questions in the "questions" array. I want to sort them by how much time is left before the question ends. I want to sort them in ascending order, so the question that ends first is at the top of the list. I also want to move all the questions that are unanswered at the top.
  const sortedQuestions = questions.sort((a, b) => {
    // Show active questions before ended questions
    if (a.ended === false && b.ended === true) {
      return -1;
    }
    if (a.ended === true && b.ended === false) {
      return 1;
    }

    // Show unanswered questions first
    if (a.user?.hasPredicted === false && b.user?.hasPredicted === true) {
      return -1;
    }
    if (a.user?.hasPredicted === true && b.user?.hasPredicted === false) {
      return 1;
    }

    // Sort by time left
    return a.ends - b.ends;
  });

  const unansweredCount = questions.filter(
    (question) =>
      question.user?.hasPredicted === false &&
      question.ends > Date.now() &&
      question.ended === false
  ).length;

  return (
    <zstack
      height="100%"
      width="100%"
      backgroundColor={
        isExpanded
          ? themedColor('secondary-background')
          : themedColor('background')
      }
    >
      <vstack height="100%" width="100%">
        {/* Header */}
        <Header
          title={appContent.tournament.name || 'No tournament found'}
          open={page !== Pages.OPTIONS}
          playerCount={appContent.tournament.playerCount || 0}
          active={!appContent.tournament.ended}
          onPress={() => handlePageChange()}
          theme={appContent.settings.theme}
        />

        {(page === Pages.QUESTIONS || page === Pages.SCORES) && (
          <Tabs
            data={[
              {
                label: 'Questions',
                value: Pages.QUESTIONS,
                count: unansweredCount,
              },
              {
                label: 'Top predictors',
                value: Pages.SCORES,
              },
            ]}
            tab={page}
            setTab={(page: Pages) => setPage(page)}
            theme={appContent.settings.theme}
          />
        )}

        {/* Options */}
        {page === Pages.OPTIONS && (
          <Options
            options={options}
            correctOption={correctOption}
            tokens={tokens}
            totalVotes={totalVotes}
            ends={appContent.post.ends}
            ended={isEnded}
            reveal={hasPredicted || isEnded}
            offset={offset}
            setOffset={setOffset}
            onOptionPress={(option) => handleOptionPress(option)}
            isModerator={isModerator}
            settings={appContent.settings}
            theme={appContent.settings.theme}
          />
        )}

        {/* Tournament: Questions */}
        {page === Pages.QUESTIONS && (
          <Questions
            questions={sortedQuestions}
            offset={offset}
            setOffset={setOffset}
            settings={appContent.settings}
            theme={appContent.settings.theme}
            userTokens={appContent.user.score}
          />
        )}

        {/* Tournament: Scoreboard*/}
        {page === Pages.SCORES && (
          <Scoreboard
            scores={appContent.scoreboard ?? []}
            settings={appContent.settings}
            theme={appContent.settings.theme}
            userTokens={appContent.user.score}
          />
        )}
      </vstack>
      {/* Screen end */}

      {/* Wager modal */}
      {modal === Modals.WAGER && option !== undefined && (
        <WagerModal
          option={option.label}
          balance={appContent.user.score || 0}
          wager={wager}
          wagerChangeHandler={wagerChangeHandler}
          setSpecificWagerForm={setSpecificWagerForm}
          onConfirm={handlePredictionSubmit}
          settings={appContent.settings}
          onClose={() => {
            setModal(undefined);
            setOption(undefined);
            setWager(defaultWager);
          }}
          theme={appContent.settings.theme}
        />
      )}

      {/* First time user experience
          This interstitial modal will be shown to users the first time they interact with a tournament.
      */}
      {modal === Modals.INTRODUCTION && (
        <IntroductionModal
          tournamentName={appContent.tournament.name}
          tournamentTokens={appContent.tournament.tokens}
          onContinue={async () => {
            await service.tournament.setIntroSeen(
              appContent.post.tournamentId,
              userId
            );
            setModal(Modals.WAGER);
          }}
          onClose={() => setModal(undefined)}
          theme={appContent.settings.theme}
        />
      )}
    </zstack>
  );
}
