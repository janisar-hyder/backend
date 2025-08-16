import { supabase } from '../config/supabase.js'

// Get user's ROI history
export const getRoiHistory = async (req, res) => {
  const userId = req.user.id

  try {
    const { data: history, error } = await supabase
      .from('roi_history')
      .select('*')
      .eq('user_id', userId)
      .order('calculated_at', { ascending: false })

    if (error) throw error

    return res.json({
      success: true,
      roiHistory: history || []
    })

  } catch (error) {
    console.error('[GET ROI HISTORY ERROR]', error.message)
    return res.status(500).json({ 
      error: 'Failed to get ROI history',
      details: error.message
    })
  }
}

// Get ROI history for specific plan
export const getPlanRoiHistory = async (req, res) => {
  const userId = req.user.id
  const { planType } = req.params

  try {
    const { data: history, error } = await supabase
      .from('roi_history')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_type', planType)
      .order('month_number', { ascending: true })

    if (error) throw error

    // Calculate statistics
    const totalEarned = history.reduce((sum, record) => sum + parseFloat(record.roi_amount), 0)
    const averageROI = history.length > 0 
      ? history.reduce((sum, record) => sum + parseFloat(record.roi_percentage), 0) / history.length 
      : 0
    const highestROI = history.length > 0 
      ? Math.max(...history.map(record => parseFloat(record.roi_percentage)))
      : 0
    const lowestROI = history.length > 0 
      ? Math.min(...history.map(record => parseFloat(record.roi_percentage)))
      : 0

    return res.json({
      success: true,
      planType,
      roiHistory: history || [],
      statistics: {
        totalMonths: history.length,
        totalEarned: totalEarned.toFixed(2),
        averageROI: averageROI.toFixed(2),
        highestROI: highestROI.toFixed(2),
        lowestROI: lowestROI.toFixed(2)
      }
    })

  } catch (error) {
    console.error('[GET PLAN ROI HISTORY ERROR]', error.message)
    return res.status(500).json({ 
      error: 'Failed to get plan ROI history',
      details: error.message
    })
  }
}

// Get ROI statistics for admin
export const getRoiStats = async (req, res) => {
  try {
    // Get overall statistics
    const { data: allHistory, error: historyError } = await supabase
      .from('roi_history')
      .select('*')

    if (historyError) throw historyError

    // Calculate overall statistics
    const totalROI = allHistory.reduce((sum, record) => sum + parseFloat(record.roi_amount), 0)
    const averageROI = allHistory.length > 0 
      ? allHistory.reduce((sum, record) => sum + parseFloat(record.roi_percentage), 0) / allHistory.length 
      : 0

    // Group by plan type
    const planStats = {}
    allHistory.forEach(record => {
      if (!planStats[record.plan_type]) {
        planStats[record.plan_type] = {
          totalEarned: 0,
          totalMonths: 0,
          averageROI: 0,
          roiPercentages: []
        }
      }
      
      planStats[record.plan_type].totalEarned += parseFloat(record.roi_amount)
      planStats[record.plan_type].totalMonths++
      planStats[record.plan_type].roiPercentages.push(parseFloat(record.roi_percentage))
    })

    // Calculate averages for each plan
    Object.keys(planStats).forEach(planType => {
      const stats = planStats[planType]
      stats.averageROI = stats.roiPercentages.reduce((sum, roi) => sum + roi, 0) / stats.roiPercentages.length
      stats.totalEarned = stats.totalEarned.toFixed(2)
      stats.averageROI = stats.averageROI.toFixed(2)
      delete stats.roiPercentages // Remove raw data from response
    })

    return res.json({
      success: true,
      overallStats: {
        totalROI: totalROI.toFixed(2),
        averageROI: averageROI.toFixed(2),
        totalMonths: allHistory.length
      },
      planStats
    })

  } catch (error) {
    console.error('[GET ROI STATS ERROR]', error.message)
    return res.status(500).json({ 
      error: 'Failed to get ROI statistics',
      details: error.message
    })
  }
} 