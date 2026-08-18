INSERT INTO "public"."reviews" ("id", "trainee_id", "reviewer_id", "review_type", "review_period", "rating", "strengths", "areas_for_improvement", "recommendation", "reviewed_at", "created_at", "updated_at", "mt_reply", "mt_reply_at") VALUES ('81cc50fb-b108-4648-b4ac-887972e25919', 'aea42483-c1be-4d6e-a070-c3ac0a33df57', 'fffa07ae-27f0-4145-9c2b-5a332d446e0f', 'encouragement', '2026-07-15', null, null, null, 'Hi, Ishi,

I would like to summarize some of the points we discussed over the past couple of days. I hope putting them into writing will help you better understand and remember them as you continue your journey with MATTA.

1. The biggest difference between school and the workplace

The biggest difference between campus life and working life is that, in the workplace, you need to use your professional knowledge, your attitude toward solving problems, your communication skills, and your personal character to work with people who have different backgrounds, personalities, and ways of thinking.

Together, you create value for the company while also building your own experience, capabilities, and career. Of course, you also earn an income that allows you to pursue the life you want. Work is not only about making a living—it''s also about continuously investing in yourself.

2. Teamwork is important, but you are still responsible for your own growth

export async function signOut() {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
    })

    accessToken = null

    if (!response.ok) {
      const result = await readResponse<ApiResponse>(response)

      return {
        error: {
          message: getErrorMessage(result, 'Failed to sign out.'),
        },
      }
    }

    return {
      error: null,
    }
  } catch (error) {
    accessToken = null

    return {
      error: {
        message:
          error instanceof Error
            ? error.message
            : 'Unable to connect to the server.',
      },
    }
  }
}

// ---------- Current user ----------

export async function getCurrentUser() {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: getHeaders(),
      credentials: 'include',
    })

    const result = await readResponse<ApiResponse>(response)

    if (!response.ok) {
      return {
        user: null,
        error: {
          message: getErrorMessage(
            result,
            'Unable to load the current user.',
          ),
        },
      }
    }

    return {
      user: normalizeUser(result.user),
      error: null,
    }
  } catch (error) {
    return {
      user: null,
      error: {
        message:
          error instanceof Error
            ? error.message
            : 'Unable to connect to the server.',
      },
    }
  }
}

// ---------- Create own trainee row ----------

export async function createOwnTraineeRow(
  payload: NewTraineePayload,
) {
  try {
    const response = await fetch(`${API_BASE_URL}/trainees`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify({
        employee_id: payload.employee_id.trim(),
        batch_code: payload.batch_code.trim(),
        education: payload.education?.trim() || null,
      }),
    })

    const result = await readResponse<ApiResponse>(response)

    if (!response.ok) {
      return {
        trainee: null,
        error: {
          message: getErrorMessage(
            result,
            'Could not save trainee details.',
          ),
        },
      }
    }

    return {
      trainee: result.trainee ?? result.data ?? result,
      error: null,
    }
  } catch (error) {
    console.error('Create trainee request failed:', error)

    return {
      trainee: null,
      error: {
        message:
          error instanceof Error
            ? error.message
            : 'Unable to connect to the server.',
      },
    }
  }
}

// ---------- Profile loader ----------

export async function loadUserProfile(userId: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/users_profile?id=${encodeURIComponent(userId)}`, {
      method: 'GET',
      headers: getHeaders(),
      credentials: 'include',
    })
    const result = await readResponse<ApiResponse>(response)
    if (!response.ok) {
      return { profile: null, error: { message: getErrorMessage(result, 'Unable to load profile.') } }
    }
    return { profile: result.data ?? null, error: null }
  } catch (error) {
    return { profile: null, error: { message: error instanceof Error ? error.message : 'Network error' } }
  }
}

export async function sendPasswordResetEmail(email: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth.php?action=forgot-password`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify({ email }),
    })
    const result = await readResponse<ApiResponse>(response)
    if (!response.ok) {
      return { error: { message: getErrorMessage(result, 'Unable to send password reset email.') } }
    }
    return { error: null }
  } catch (error) {
    return { error: { message: error instanceof Error ? error.message : 'Network error' } }
  }
}

export async function updateOwnPassword(password: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth.php?action=update-password`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify({ password }),
    })
    const result = await readResponse<ApiResponse>(response)
    if (!response.ok) {
      return { error: { message: getErrorMessage(result, 'Unable to update password.') } }
    }
    return { error: null }
  } catch (error) {
    return { error: { message: error instanceof Error ? error.message : 'Network error' } }
  }
}

While teamwork is essential, never forget that you are the main person responsible for your own development.

No one else can replace your attitude, your willingness to learn, or your determination to improve. Learn how to work well with others, but also learn how to manage yourself.

3. Great achievements are never accomplished alone

No major project is completed by one person alone.

Every successful project is the result of people with different expertise working together toward the same goal. When everyone contributes their strengths, the result is far greater than what any individual could achieve alone.

The important question, then, is not "How can I do everything myself?" but rather:

"How can I earn the trust and willingness of others to work with me?"

This is actually one of the central ideas behind many of the lessons I share—how to gain support, build trust, and create collaboration.

4. MATTA is developing future leaders, not only professionals

MATTA is not only designed to develop technical or professional expertise.

More importantly, we hope to cultivate future managers and leaders who can organize, inspire, and develop teams.

For this reason, besides strengthening your own professional capability, we will continue emphasizing teamwork, communication, leadership, and the ability to develop others.

A great leader is not someone who can do everything alone, but someone who can help others grow. When knowledge and capability can be shared and multiplied, the entire team becomes stronger.

5. Keep improving yourself

Professional knowledge is important, but it is only one part of your development.

Continue improving your:

. Professional competence
. Problem-solving ability
. Communication skills
. EQ
. Humility and professionalism
. Respect for others
. Learning attitude

These qualities will determine how far you can grow in your career.

6. Don''t become a work machine

Everything we teach in MATTA is not intended to turn you into a work machine that only chases targets and performance.

These skills are simply tools to help you build the life you want.

Every experience you gain today is preparing you to become a better version of yourself. The more knowledge, experience, and wisdom you accumulate, the more choices you will have in designing your own future.

Our goal is not simply to build successful employees—it is to help you build a successful life.

Finally, I hope you will always stay curious, observe more, learn continuously, and be willing to change.

Every morning we give you time to read industry news, AI developments, business updates, and even political and economic news. The purpose is not simply to increase your knowledge, but to help you develop a broader perspective.

The world is changing rapidly. Future leaders cannot focus only on their own department or technical field—they need to understand the world around them.

One last reminder:

This is no longer school.

Don''t wait for someone to tell you what you should learn.
Take the initiative.
Ask questions.
Observe.
Learn.

Improve yourself every day.

If you can become just a little better than yesterday, you''re already moving in the right direction.

Let''s keep learning and growing together. ^_^', '2026-07-15 01:13:24.26391+00', '2026-07-15 01:13:24.26391+00', '2026-07-15 03:40:00.91809+00', 'Hello Sir Yangson,
Thank you for the encouragement, feedback, and summary; I will make sure to take these to 
heart as I go on my journey towards being a better employee and person. I''m aiming for the goal of 
trusting myself more as an individual and to stop doubting myself because that is something that I have 
been struggling about for a very long time.  I look forward to what MATTA and my future experiences 
will make me discover about myself and my own capabilities, I am inexperienced as this is my first job 
but I will do my best every day. Again, thank you very much!', '2026-07-15 03:40:00.91809+00');