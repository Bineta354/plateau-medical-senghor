import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  Search,
  User,
  X,
  FileText,
  CalendarDays,
  EyeOff,
  Eye,
} from 'lucide-react'

const VIEW_OPTIONS = [
  { value: 'timeGridDay', label: 'Jour' },
  { value: 'timeGridWeek', label: 'Semaine' },
  { value: 'dayGridMonth', label: 'Mois' },
]

const CalendarHeader = ({
  handlePrev,
  handleNext,
  handleToday,
  getDateDisplayText,
  getNavigationText,
  calendarView,
  viewingToday = false,
  handleViewChange,
  searchTerm,
  setSearchTerm,
  searchPatientsAndMotifs,
  clearSearch,
  showSearchDropdown,
  setShowSearchDropdown,
  searchResults,
  selectSearchResult,
  selectedSearchResult,
  setSelectedSearchResult,
  localDoctorFilter,
  handleDoctorFilterChange,
  medecins,
  disableDoctorFilter,
  doctorPlanningLabel,
  availableSpecialties,
  selectedSpecialty,
  setSelectedSpecialty,
  setEditingAppointment,
  setShowAppointmentModal,
  hidePastAppointments = true,
  onToggleHidePastAppointments,
  compact = false,
}) => {
  return (
    <div
      className={`calendar-header border-b border-slate-200 bg-white flex-shrink-0 ${
        compact ? 'px-2 py-1.5' : 'px-4 py-3'
      }`}
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handlePrev}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            title={`${getNavigationText()} précédente`}
            type="button"
          >
            <ChevronLeft size={20} className="text-gray-600" />
          </button>

          <button
            onClick={handleToday}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-blue-600 border border-blue-600 text-white hover:bg-blue-700 hover:border-blue-700 shadow-sm transition-colors"
            title="Revenir à aujourd'hui"
          >
            <CalendarDays size={16} />
            Aujourd&apos;hui
          </button>

          <button
            onClick={handleNext}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            title={`${getNavigationText()} suivante`}
            type="button"
          >
            <ChevronRight size={20} className="text-gray-600" />
          </button>

          <div className="flex items-center gap-2 ml-1">
            <button
              onClick={handleToday}
              type="button"
              className={`text-lg font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                viewingToday
                  ? 'text-blue-700'
                  : 'text-gray-900 hover:text-blue-600'
              }`}
              title="Aller à aujourd'hui"
            >
              {getDateDisplayText()}
            </button>
            {viewingToday && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 ring-1 ring-blue-200">
                Aujourd&apos;hui
              </span>
            )}
            {calendarView === 'timeGridDay' && (
              <span className="text-xs text-gray-500 whitespace-nowrap">
                Vue journée
              </span>
            )}
            {calendarView === 'dayGridMonth' && (
              <span className="text-xs text-gray-500 whitespace-nowrap">
                Vue mois
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3 flex-wrap gap-3">
          <div className="relative search-container">
            <Search
              size={16}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Rechercher un patient ou motif..."
              value={searchTerm}
              onChange={(e) => {
                const value = e.target.value
                setSearchTerm(value)
                searchPatientsAndMotifs(value)
                if (selectedSearchResult) {
                  setSelectedSearchResult(null)
                }
              }}
              onFocus={() => {
                if (searchResults.length > 0) {
                  setShowSearchDropdown(true)
                }
              }}
              onBlur={() => {
                setTimeout(() => setShowSearchDropdown(false), 150)
              }}
              className="pl-10 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-56 xl:w-64"
            />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                title="Effacer la recherche"
                type="button"
              >
                <X size={14} className="text-gray-400" />
              </button>
            )}

            {showSearchDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                <div className="p-2">
                  {searchResults.map((result, index) => (
                    <button
                      key={`${result.type}-${result.id}-${index}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectSearchResult(result)}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                      type="button"
                    >
                      <div className="flex items-center space-x-2">
                        <div
                          className={`p-1 rounded-full ${
                            result.type === 'patient'
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-green-100 text-green-600'
                          }`}
                        >
                          {result.type === 'patient' ? (
                            <User size={12} />
                          ) : (
                            <FileText size={12} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {result.name}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {result.type === 'patient'
                              ? result.phone
                                ? `📞 ${result.phone}`
                                : 'Patient'
                              : result.motif
                                ? result.motif
                                : 'Rendez-vous'}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {disableDoctorFilter && doctorPlanningLabel && (
            <span className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-gray-700 whitespace-nowrap">
              {doctorPlanningLabel}
            </span>
          )}

          {!disableDoctorFilter && (
            <div className="relative">
              <select
                value={localDoctorFilter}
                onChange={(e) => handleDoctorFilterChange(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tous les médecins</option>
                {medecins.map((medecin) => (
                  <option key={medecin.id} value={medecin.id}>
                    {medecin.couleur ? `● ` : ''}Dr. {medecin.prenom} {medecin.nom}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!disableDoctorFilter && availableSpecialties.length > 0 && (
            <div className="relative">
              <select
                value={selectedSpecialty}
                onChange={(e) => setSelectedSpecialty(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Toutes les spécialités</option>
                {availableSpecialties.map((specialite) => (
                  <option key={specialite} value={specialite}>
                    {specialite}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(disableDoctorFilter && selectedSearchResult) ||
          (!disableDoctorFilter &&
            (localDoctorFilter !== 'all' ||
              selectedSearchResult ||
              selectedSpecialty !== 'all')) ? (
            <div className="flex items-center space-x-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
              <Filter size={14} />
              <span>Filtres actifs</span>
              {selectedSpecialty !== 'all' && !disableDoctorFilter && (
                <button
                  onClick={() => setSelectedSpecialty('all')}
                  className="bg-white/70 text-blue-700 px-2 py-0.5 rounded-full text-xs hover:bg-white transition-colors"
                  title="Supprimer le filtre spécialité"
                  type="button"
                >
                  {selectedSpecialty}
                  <span className="ml-1">x</span>
                </button>
              )}
              {selectedSearchResult && (
                <button
                  onClick={clearSearch}
                  className="ml-2 hover:bg-blue-200 rounded-full p-1 transition-colors"
                  title="Effacer la recherche"
                  type="button"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex items-center space-x-3 flex-wrap">
          {/*{onToggleHidePastAppointments && (
            <button
              type="button"
              onClick={onToggleHidePastAppointments}
              title={
                hidePastAppointments
                  ? 'Afficher les RDV passés'
                  : 'Masquer les RDV passés'
              }
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                hidePastAppointments
                  ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {hidePastAppointments ? <EyeOff size={16} /> : <Eye size={16} />}
              {hidePastAppointments ? 'RDV passés masqués' : 'RDV passés visibles'}
            </button>
          )}*/}

          <div className="bg-slate-100 p-1 rounded-lg border border-slate-200">
            <div className="flex gap-1">
              {VIEW_OPTIONS.map((view) => (
                <button
                  key={view.value}
                  onClick={() => handleViewChange(view.value)}
                  type="button"
                  className={`py-2 px-3 rounded-md font-semibold text-sm transition-colors ${
                    calendarView === view.value
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/70'
                  }`}
                >
                  {view.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              setEditingAppointment(null)
              setShowAppointmentModal(true)
            }}
            type="button"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors shadow-sm font-semibold text-sm whitespace-nowrap"
          >
            <Plus size={18} />
            <span>Nouveau RDV</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default CalendarHeader
