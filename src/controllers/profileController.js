// src/controllers/profileControllers.js
import supabase from '../config/supabase.js'

export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id // This comes from JWT middleware

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('[GET PROFILE ERROR]', error.message)
      return res.status(404).json({ error: 'Profile not found' })
    }

    res.json({
      message: 'Profile fetched successfully',
      profile: data
    })
  } catch (err) {
    console.error('[PROFILE ERROR]', err.message)
    res.status(500).json({ error: 'Something went wrong' })
  }
}
