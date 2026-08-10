import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import resourceTimeGridPlugin from '@fullcalendar/resource-timegrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import RdvCreationModal from './rendez-vous/RdvCreationModal'
import { useNewCalendar } from '../hooks/useNewCalendar'
import { isPastAppointment as checkPastAppointment } from '../utils/appointmentDisplay'
import CalendarHeader from './calendar/CalendarHeader'
import StatsCards from './calendar/StatsCards'
import React, { useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react'
import { usePersonnalisation } from '../contexts/PersonnalisationContext'
import { DEFAULT_HORAIRES_OUVERTURE, JOURS_SEMAINE } from '../utils/horairesOuverture'

const NewCalendar = ({
  selectedDoctorFilter,
  disableDoctorFilter = false,
  fillViewport = false,
}) => {
  const [showStats, setShowStats] = useState(!fillViewport)
  const {
    loading,
    calendarRef,
    calendarView,
    searchTerm,
    searchResults,
    showSearchDropdown,
    selectedSearchResult,
    showAppointmentModal,
    modalInitialDate,
    modalInitialDuration,
    modalInitialDoctorId,
    modalInitialPatientId,
    modalInitialSpecialty,
    editingAppointment,
    animatedStats,
    selectedSpecialty,
    localDoctorFilter,
    calendarEvents,
    calendarResources,
    dayViewMinWidth,
    stats,
    medecins,

    setSearchTerm,
    setShowSearchDropdown,
    setSelectedSearchResult,
    setShowAppointmentModal,
    setEditingAppointment,
    setSelectedSpecialty,

    loadData,
    availableSpecialties,
    searchPatientsAndMotifs,
    clearSearch,
    selectSearchResult,
    getNavigationText,
    getDateDisplayText,
    handlePrev,
    handleNext,
    handleToday,
    handleViewChange,
    handleDateSelect,
    handleEventClick,
    handleEventDrop,
    handleEventResize,
    handleDoctorFilterChange,
    handleDatesSet,
    deleteAppointment,

    RESOURCE_AREA_WIDTH,
    createAppointment,
    updateAppointment,
    getAppointmentErrorMessage,
    doctorPlanningLabel,
    useResourceDayView,
    viewingToday,
    handleDateClick,
    dayCellClassNames,
    resolveFullCalendarView,
    hidePastAppointments,
    toggleHidePastAppointments,
    urgentOnly,
    toggleUrgentOnly,
    reportPastAppointment,
  } = useNewCalendar({
    selectedDoctorFilter,
    disableDoctorFilter,
  })

  const { settings: personnalisationSettings } = usePersonnalisation()
  const horairesOuverture = personnalisationSettings?.horaires_ouverture || DEFAULT_HORAIRES_OUVERTURE

  const { businessHours, hiddenDays, slotMinTime, slotMaxTime } = useMemo(() => {
    const openDays = []
    JOURS_SEMAINE.forEach((jour, dayIndex) => {
      const horaire = horairesOuverture?.[jour]
      if (horaire?.ouvert && horaire.debut && horaire.fin) {
        openDays.push({ dayIndex, ...horaire })
      }
    })

    if (openDays.length === 0) {
      return {
        businessHours: false,
        hiddenDays: [0, 1, 2, 3, 4, 5, 6],
        slotMinTime: '08:00:00',
        slotMaxTime: '18:00:00',
      }
    }

    const closedDayIndexes = JOURS_SEMAINE
      .map((_, dayIndex) => dayIndex)
      .filter((dayIndex) => !openDays.some((d) => d.dayIndex === dayIndex))

    return {
      businessHours: openDays.map((d) => ({
        daysOfWeek: [d.dayIndex],
        startTime: d.debut,
        endTime: d.fin,
      })),
      hiddenDays: closedDayIndexes,
      slotMinTime: `${openDays.reduce((min, d) => (d.debut < min ? d.debut : min), openDays[0].debut)}:00`,
      slotMaxTime: `${openDays.reduce((max, d) => (d.fin > max ? d.fin : max), openDays[0].fin)}:00`,
    }
  }, [horairesOuverture])

  const fullCalendarView = resolveFullCalendarView()
  const isMonthView = calendarView === 'dayGridMonth'
  const isTimeGridView =
    calendarView === 'timeGridWeek' || calendarView === 'timeGridDay'

  const getEventDurationMinutes = (event, props) => {
    const fromProps = Number(props.durationMinutes)
    if (fromProps > 0) return fromProps
    if (event.start && event.end) {
      return Math.max(
        1,
        Math.round((event.end.getTime() - event.start.getTime()) / 60000),
      )
    }
    return 30
  }

  const renderEventContent = (eventInfo) => {
    const { event, timeText } = eventInfo
    const props = event.extendedProps || {}
    const patientName = props.patientName || event.title || 'Rendez-vous'
    const motif = (props.motif || props.motif_detaille || '').trim()
    const duration = getEventDurationMinutes(event, props)
    const tooltip = [timeText, patientName, motif].filter(Boolean).join(' — ')

    if (duration <= 25) {
      return (
        <div
          className="gc-event-content gc-event-content--compact"
          title={tooltip}
        >
          <span className="gc-event-inline">
            <span className="gc-event-time">{timeText}</span>
            <span className="gc-event-title">{patientName}</span>
          </span>
        </div>
      )
    }

    return (
      <div className="gc-event-content" title={tooltip}>
        <div className="gc-event-time">{timeText}</div>
        <div className="gc-event-title">{patientName}</div>
        {duration > 35 && motif ? (
          <div className="gc-event-meta">{motif}</div>
        ) : null}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto" />
          <p className="text-gray-600 text-lg font-medium">
            Chargement du calendrier...
          </p>
        </div>
      </div>
    )
  }

  const shellClass = fillViewport
    ? 'google-calendar-shell google-calendar-shell--fill h-full min-h-0 flex-1'
    : 'google-calendar-shell flex-1 min-h-[520px] h-full'

  return (
    <div
      className={`${shellClass} bg-slate-100 transition-all duration-300 flex flex-col relative overflow-hidden`}
    >
      {fillViewport && (
        <div className="flex-shrink-0 flex items-center justify-between px-2 py-1 border-b border-slate-200 bg-white/80">
          <button
            type="button"
            onClick={() => setShowStats((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-blue-700 px-2 py-1 rounded-md hover:bg-slate-100"
          >
            <BarChart3 size={14} />
            Statistiques
            {showStats ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <span className="text-[11px] text-slate-500 pr-2">
            Le calendrier utilise toute la hauteur de l&apos;écran
          </span>
        </div>
      )}
      {(!fillViewport || showStats) && (
        <div className="flex-shrink-0">
          <StatsCards
            stats={stats}
            animatedStats={animatedStats}
            compact={fillViewport}
            activeStatLabel={
              urgentOnly
                ? 'Urgences'
                : !hidePastAppointments
                  ? 'Total RDV'
                  : null
            }
            onStatClick={{
              'Total RDV': () => {
                if (hidePastAppointments) toggleHidePastAppointments()
              },
              "Aujourd'hui": handleToday,
              Urgences: toggleUrgentOnly,
            }}
          />
        </div>
      )}

      <div
        className={`flex-1 flex flex-col min-h-0 overflow-hidden ${
          fillViewport ? 'px-1 pb-1' : 'px-3 pb-3 sm:px-4 sm:pb-4'
        }`}
      >
        <div className="google-calendar-surface bg-white border border-slate-200 overflow-hidden flex-1 flex flex-col min-h-0 shadow-sm">
          <CalendarHeader
            compact={fillViewport}
            handlePrev={handlePrev}
            handleNext={handleNext}
            handleToday={handleToday}
            getDateDisplayText={getDateDisplayText}
            getNavigationText={getNavigationText}
            calendarView={calendarView}
            viewingToday={viewingToday}
            handleViewChange={handleViewChange}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            searchPatientsAndMotifs={searchPatientsAndMotifs}
            clearSearch={clearSearch}
            showSearchDropdown={showSearchDropdown}
            setShowSearchDropdown={setShowSearchDropdown}
            searchResults={searchResults}
            selectSearchResult={selectSearchResult}
            selectedSearchResult={selectedSearchResult}
            setSelectedSearchResult={setSelectedSearchResult}
            localDoctorFilter={localDoctorFilter}
            handleDoctorFilterChange={handleDoctorFilterChange}
            medecins={medecins}
            disableDoctorFilter={disableDoctorFilter}
            doctorPlanningLabel={doctorPlanningLabel}
            availableSpecialties={availableSpecialties}
            selectedSpecialty={selectedSpecialty}
            setSelectedSpecialty={setSelectedSpecialty}
            setEditingAppointment={setEditingAppointment}
            setShowAppointmentModal={setShowAppointmentModal}
            hidePastAppointments={hidePastAppointments}
            onToggleHidePastAppointments={toggleHidePastAppointments}
          />

          <div
            className={`flex-1 relative overflow-hidden min-h-0 ${
              fillViewport ? '' : 'min-h-[400px]'
            }`}
          >
            {calendarEvents.length === 0 && (
              <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                
              </div>
            )}
            <div className="absolute inset-0 overflow-x-auto overflow-y-hidden">
              {calendarView === 'timeGridDay' && useResourceDayView && (
                <div className="absolute top-0 bottom-0 left-0 w-[64px] pointer-events-none gradient-mask-l-0">
                  <div className="h-full w-full bg-gradient-to-r from-white via-white/70 to-transparent" />
                </div>
              )}
              <div
                className="h-full min-h-full"
                style={{
                  minWidth: dayViewMinWidth ? `${dayViewMinWidth}px` : '100%',
                  width: '100%',
                }}
              >
                <FullCalendar
                  ref={calendarRef}
                  schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
                  plugins={[
                    dayGridPlugin,
                    timeGridPlugin,
                    interactionPlugin,
                    listPlugin,
                    resourceTimeGridPlugin,
                  ]}
                  headerToolbar={false}
                  initialView={fullCalendarView}
                  events={calendarEvents}
                  resources={
                    calendarView === 'timeGridDay' && useResourceDayView
                      ? calendarResources
                      : undefined
                  }
                  eventClick={handleEventClick}
                  eventContent={renderEventContent}
                  eventDrop={isTimeGridView ? handleEventDrop : undefined}
                  eventResize={isTimeGridView ? handleEventResize : undefined}
                  editable={isTimeGridView}
                  selectable={isTimeGridView}
                  select={isTimeGridView ? handleDateSelect : undefined}
                  dateClick={isMonthView ? handleDateClick : undefined}
                  selectConstraint={isTimeGridView ? 'businessHours' : undefined}
                  dayCellClassNames={dayCellClassNames}
                  fixedWeekCount={false}
                  showNonCurrentDates
                  dayMaxEventRows={isMonthView ? 3 : false}
                  moreLinkClick="popover"
                  eventMaxStack={isMonthView ? 2 : undefined}
                  height="100%"
                  locale="fr"
                  slotMinTime={slotMinTime}
                  slotMaxTime={slotMaxTime}
                  allDaySlot={false}
                  slotDuration="00:30:00"
                  snapDuration="00:15:00"
                  slotLabelInterval="01:00"
                  eventTimeFormat={{
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  }}
                  dayHeaderFormat={{
                    weekday: 'long',
                    day: 'numeric',
                  }}
                  slotLabelFormat={{
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  }}
                  eventDisplay="block"
                  eventResizableFromStart={isTimeGridView}
                  droppable={isTimeGridView}
                  selectMirror={isTimeGridView}
                  eventClassNames="google-calendar-event cursor-pointer"
                  businessHours={businessHours}
                  hiddenDays={hiddenDays}
                  nowIndicator
                  scrollTime={slotMinTime}
                  expandRows
                  stickyHeaderDates
                  weekNumbers={false}
                  handleWindowResize
                  windowResizeDelay={100}
                  resourceAreaWidth={
                    calendarView === 'timeGridDay' && useResourceDayView
                      ? RESOURCE_AREA_WIDTH
                      : undefined
                  }
                  datesSet={handleDatesSet}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <RdvCreationModal
        isOpen={showAppointmentModal}
        onClose={() => {
          setShowAppointmentModal(false)
          setEditingAppointment(null)
        }}
        initialDate={modalInitialDate}
        initialDoctorId={modalInitialDoctorId}
        initialPatientId={modalInitialPatientId}
        initialDuration={modalInitialDuration}
        initialSpecialty={modalInitialSpecialty}
        editingAppointment={editingAppointment}
        createAppointment={createAppointment}
        updateAppointment={updateAppointment}
        deleteAppointment={deleteAppointment}
        getAppointmentErrorMessage={getAppointmentErrorMessage}
        restrictToCurrentDoctor={disableDoctorFilter}
        onSuccess={async () => {
          await loadData()
        }}
        onDelete={
          editingAppointment
            ? async (appointmentId) => {
                if (!window.confirm('Supprimer ce rendez-vous ?')) return
                try {
                  await deleteAppointment(appointmentId)
                } catch (error) {
                  console.error(
                    'Erreur lors de la suppression du rendez-vous:',
                    error,
                  )
                }
              }
            : undefined
        }
        onReportPast={
          editingAppointment &&
          checkPastAppointment(editingAppointment) &&
          reportPastAppointment
            ? async () => {
                if (
                  !window.confirm(
                    'Annuler ce rendez-vous passé ? Il sera masqué du calendrier (statut annulé). Vous pourrez en créer un nouveau.',
                  )
                ) {
                  return
                }
                try {
                  await reportPastAppointment(editingAppointment.id)
                  setShowAppointmentModal(false)
                  setEditingAppointment(null)
                } catch (error) {
                  alert(`Erreur: ${error.message}`)
                }
              }
            : undefined
        }
        isPastAppointment={
          editingAppointment ? checkPastAppointment(editingAppointment) : false
        }
      />
    </div>
  )
}
NewCalendar.propTypes = {
  selectedDoctorFilter: PropTypes.string,
  disableDoctorFilter: PropTypes.bool,
  fillViewport: PropTypes.bool,
}

export default NewCalendar
