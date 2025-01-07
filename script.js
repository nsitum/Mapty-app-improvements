'use strict';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const showAllWorkouts = document.querySelector('.show__workouts');

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // min
  }

  _setDescription() {
    this.description = `${
      this.type[0].toUpperCase() + this.type.slice(1)
    } on ${this.date.toLocaleDateString(navigator.language, {
      month: 'long',
      day: 'numeric',
    })}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    // this.type = 'cycling';
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// const run1 = new Running([39, -12], 5.2, 24, 178);
// const cycling1 = new Cycling([39, -12], 27, 95, 523);
// console.log(run1, cycling1);

///////////////////////////////////////
// APPLICATION ARCHITECTURE
class App {
  #map;
  #mapEvent;
  #workouts = [];
  #markers = [];
  #mapZoom = 13;
  #editWorkout;

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToWorkout.bind(this));
    showAllWorkouts.addEventListener('click', this._showAllWorkouts.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        this._showMessage.bind(this, 'error', 'position')
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    console.log(`https://www.google.com/maps/@${latitude},${longitude}`);
    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoom);
    // console.log(map);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(workout => {
      this._renderWorkoutMarker(workout);
    });
  }

  _showAllWorkouts() {
    if (this.#workouts.length === 0) {
      this._showMessage('alert', 'empty');
      return;
    }
    const locations = this.#workouts.map(workout => workout.coords);
    const bounds = L.latLngBounds(locations);
    this.#map.fitBounds(bounds);
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;

    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _showEditForm(workout) {
    this._showForm();
    inputDistance.value = workout.distance;
    inputDuration.value = workout.duration;
    if (workout.type === 'running') {
      inputType.value = 'running';
      inputElevation.closest('.form__row').classList.add('form__row--hidden');
      inputCadence.closest('.form__row').classList.remove('form__row--hidden');
      inputCadence.value = workout.cadence;
    }
    if (workout.type === 'cycling') {
      inputType.value = 'cycling';
      //prettier-ignore
      inputElevation.closest('.form__row').classList.remove('form__row--hidden');
      inputCadence.closest('.form__row').classList.add('form__row--hidden');
      inputElevation.value = workout.elevationGain;
    }

    form.classList.add('form--edit');
    this.#editWorkout = workout;
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) => {
      let validCounter = 0;
      inputs.forEach(input => {
        if (Number.isFinite(input)) validCounter++;
        // inputs.every(inp => Number.isFinite(inp));
      });
      if (validCounter === inputs.length) return true;
      return false;
    };

    const checkPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();
    const editWorkout = form.classList.contains('form--edit');

    // Get data from the form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    let lat, lng;
    let workout;

    if (!editWorkout) ({ lat, lng } = this.#mapEvent.latlng);

    // If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !checkPositive(distance, duration, cadence)
      )
        return this._showMessage('error', 'input');

      if (!editWorkout)
        workout = new Running([lat, lng], distance, duration, cadence);
      else {
        workout = new Running(
          this.#editWorkout.coords,
          distance,
          duration,
          cadence
        );
        workout.date = this.#editWorkout.date;
      }
    }

    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      if (
        !validInputs(distance, duration, elevation) ||
        !checkPositive(distance, duration)
      )
        return this._showMessage('error', 'input');

      if (!editWorkout)
        workout = new Cycling([lat, lng], distance, duration, elevation);
      else {
        workout = new Cycling(
          this.#editWorkout.coords,
          distance,
          duration,
          elevation
        );
        workout.date = this.#editWorkout.date;
      }
    }

    //prettier-ignore
    // const typeChangeOnEdit = !(this.#workouts[this.#workouts.indexOf(this.#editWorkout)].type === workout.type);
    // console.log(typeChangeOnEdit);

    if (editWorkout) {
      // Delete edited workout from workouts array
      this.#workouts.splice(this.#workouts.indexOf(this.#editWorkout), 1);
    }

    this.#workouts.push(workout);

    // Add new object to workout array

    // MY WAY
    /*
    // Check if data is valid
    if (!(distance >= 0 && duration >= 0 && cadence >= 0 && elevation >= 0))
      alert('The input must be a positive number!');
    // If workout running, create running object
    else if (type == 'running') {
      const cadence = +inputCadence.value;
      const running = new Running([lat, lng], distance, duration, cadence);
      // Add new object to workout array
      this.workouts.push(running);
      // If workout cycling, create cycling object
    } else if (type == 'cycling') {
      const elevation = +inputElevation.value;
      const cycling = new Cycling([lat, lng], distance, duration, elevation);
      // Add new object to workout array
      this.workouts.push(cycling);
    }
    */

    // Render workout on map as marker
    // const editedMarker = editWorkout && !typeChangeOnEdit;
    this._renderWorkoutMarker(workout);

    if (!editWorkout) {
      // Render workout on list
      this._renderWorkout(workout);
    } else {
      this._sortByDate();
      // Render workout on list
      this._renderAllWorkouts();
      this._showMessage('alert', 'edit');
    }

    // Hide form + clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();

    // Show message
    this._showMessage('create', 'workout');

    form.classList.remove('form--edit');
  }

  _renderWorkoutMarker(workout) {
    // if (editedMarker) return;
    this._deleteMarker(workout);

    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();

    this.#markers.push(marker);
  }

  _renderWorkout(workout) {
    let workoutHTML = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
      <h2 class="workout__title">${workout.description}</h2>
      <div class="workout__details">
        <span class="workout__icon">${
          workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
        }</span>
        <span class="workout__value">${workout.distance}</span>
        <span class="workout__unit">km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⏱</span>
        <span class="workout__value">${workout.duration}</span>
        <span class="workout__unit">min</span>
      </div>
      <i class="fa-solid fa-ellipsis-vertical"></i>
      <div class="workout__menu">
        <ul>
          <li class="edit__workout"><p>Edit workout</p></li>
          <li class="delete__workout"><p>Delete workout</p></li>
          <li class="delete__workout__all"><p>Delete all workouts</p></li>
          <li class="sort__distance" data-field="distance"><p>Sort by distance</p></li>
          <li class="sort__duration" data-field="duration"><p>Sort by duration</p></li>`;

    if (workout.type === 'running') {
      workoutHTML += `
          <li class="sort__pace" data-field="pace"><p>Sort by pace</p></li>
          <li class="sort__cadence" data-field="cadence"><p>Sort by cadence</p></li>
        </ul>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${workout.pace.toFixed(1)}</span>
        <span class="workout__unit">min/km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">🦶🏼</span>
        <span class="workout__value">${workout.cadence}</span>
        <span class="workout__unit">spm</span>
      </div>
    </li>`;
    }

    if (workout.type === 'cycling') {
      workoutHTML += `
          <li class="sort__speed" data-field="speed"><p>Sort by speed</p></li>
          <li class="sort__elevation" data-field="elevation"><p>Sort by elevation gain</p></li>
        </ul>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${workout.speed.toFixed(1)}</span>
        <span class="workout__unit">km/h</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⛰</span>
        <span class="workout__value">${workout.elevationGain}</span>
        <span class="workout__unit">m</span>
      </div>
    </li>`;
    }

    form.insertAdjacentHTML('afterend', workoutHTML);
  }

  _renderAllWorkouts() {
    //Init container
    this._deleteAllWorkoutElements();

    this.#workouts.forEach(workout => {
      this._renderWorkout(workout);
    });
  }

  _findWorkout(workoutEl) {
    return this.#workouts.find(workout => workout.id === workoutEl?.dataset.id);
  }

  _moveToWorkout(e) {
    const workoutEl = e.target.closest('.workout');
    const workoutMenus = document.querySelectorAll('.workout__menu');
    if (!workoutEl) return;

    const workout = this._findWorkout(workoutEl);

    this.#map.setView(workout.coords, this.#mapZoom, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    this._moveToEdit(e, workout);

    // Hide menu when you click anywhere
    if (!e.target.classList.contains('fa-ellipsis-vertical')) {
      workoutMenus.forEach(menu => {
        menu.classList.remove('menu--active');
      });
    }
    // using the public interface
    workout.click();
  }

  _deleteAllWorkoutElements() {
    form.parentElement.querySelectorAll('li').forEach(li => {
      li.remove();
    });
  }

  _deleteMarker(workout) {
    this.#markers.forEach(marker => {
      const { lat, lng } = marker.getLatLng();
      const latLng = [lat, lng];
      if (JSON.stringify(latLng) === JSON.stringify(workout.coords)) {
        this.#map.removeLayer(marker);
      }
    });
  }

  _askPermissionToDelete(deleteAll, workoutEl, workout) {
    //prettier-ignore
    const confirmationModal = document.querySelector('.confirmation__modal')
    console.log(confirmationModal);
    confirmationModal.classList.add('confirmation__show');
    confirmationModal.addEventListener(
      'click',
      function (e) {
        e.preventDefault();
        if (e.target.closest('.confirmation__btn__ok') && !deleteAll) {
          this._deleteWorkout(workoutEl, workout);
          confirmationModal.classList.remove('confirmation__show');
        }
        if (e.target.closest('.confirmation__btn__cancel')) {
          confirmationModal.classList.remove('confirmation__show');
        }
        if (e.target.closest('.confirmation__btn__ok') && deleteAll) {
          this._deleteAllWorkouts();
          confirmationModal.classList.remove('confirmation__show');
        }
      }.bind(this)
    );
  }

  _deleteWorkout(workoutEl, workout) {
    this._deleteMarker(workout);
    this.#workouts.splice(this.#workouts.indexOf(workout), 1);
    workoutEl.remove();
    this._setLocalStorage();
    this._showMessage('alert', 'delete');
  }

  _deleteAllMarkers() {
    this.#markers.forEach(marker => {
      this.#map.removeLayer(marker);
    });
  }

  _deleteAllWorkouts() {
    this.#workouts = [];
    this._deleteAllMarkers();
    this.#markers = [];
    this._deleteAllWorkoutElements();
    this._setLocalStorage();
    this._showMessage('alert', 'delete--all');
  }

  _sortByDate() {
    this.#workouts.sort((a, b) => a.date - b.date);
  }

  _sortByField(field) {
    this.#workouts.sort((a, b) => a[field] - b[field]);
    this._renderAllWorkouts();
    this._showMessage('alert', `${field}`);
  }

  _moveToEdit(e, workout) {
    const workoutMenu = e.target.nextElementSibling;

    if (e.target.classList.contains('fa-ellipsis-vertical'))
      workoutMenu.classList.contains('menu--active')
        ? workoutMenu.classList.remove('menu--active')
        : workoutMenu.classList.add('menu--active');

    if (e.target.closest('.edit__workout')) {
      this._showEditForm(workout);
    }

    if (e.target.closest('.delete__workout')) {
      const deleteWorkoutEl = e.target.closest('.workout');
      this._askPermissionToDelete(false, deleteWorkoutEl, workout);
    }

    if (e.target.closest('.delete__workout__all')) {
      this._askPermissionToDelete(true);
    }

    if (e.target.closest('[data-field]')) {
      //prettier-ignore
      const field = Array.from(e.target.closest('[data-field]').classList)[0].slice(6);
      this._sortByField(field);
      this._setLocalStorage();
    }
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data.map(d => {
      if (d.type === 'running') {
        return new Running(d.coords, d.distance, d.duration, d.cadence);
      }

      if (d.type === 'cycling')
        return new Cycling(d.coords, d.distance, d.duration, d.elevationGain);
    });

    this.#workouts.forEach(workout => {
      this._renderWorkout(workout);
    });
  }

  _showMessage(type, message) {
    const element = document.querySelector(`.${type}__${message}`);
    console.log(element);
    console.log(element.parentElement.classList.contains('message__show'));
    if (!element.parentElement.classList.contains('message__show')) {
      element.parentElement.classList.add('message__show', `message__${type}`);
      element.classList.remove('message__hidden');
      setTimeout(() => {
        element.parentElement.classList.remove(
          'message__show',
          `message__${type}`
        );
        element.classList.add('message__hidden');
      }, 3000);
    }
    element.parentElement.addEventListener('click', function () {
      element.parentElement.classList.remove(
        'message__show',
        `message__${type}`
      );
      element.classList.add('message__hidden');
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
