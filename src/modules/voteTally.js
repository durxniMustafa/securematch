/*****************************************************************
 *  Vote meter — Chart.js edition
 *****************************************************************/
import { subscribe, get, set } from '../store.js';
import Chart from 'chart.js/auto';

let chart;
let interval;

/* ——— public ——— */
export function startVoteMeter() {
    const canvas = document.getElementById('voteChart');
    if (!canvas) return;                     // nothing to do in headless tests

    canvas.classList.remove('hidden');

    chart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['Yes', 'No'],
            datasets: [{
                label: 'Votes',
                data: [0, 0],
                backgroundColor: ['limegreen', 'tomato'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: false,
            scales: { y: { beginAtZero: true, precision: 0 } }
        }
    });

    /* periodic refresh (200 ms ≈ 5 Hz) */
    interval = setInterval(updateChart, 200);

    /* …plus instant update whenever the global store changes */
    subscribe(updateChart);
}

export function stopVoteMeter() {
    if (interval) clearInterval(interval);
    interval = null;

    if (chart) {
        chart.destroy();
        chart = null;
    }

    const cv = document.getElementById('voteChart');
    if (cv) cv.classList.add('hidden');
}

/* NEW — wipe both the chart and the stored counts */
export function resetVoteMeter() {
    /* zero the data in the global store (if you keep tallies there) */
    set({ tally: { yes: 0, no: 0 } });

    /* and redraw the bars */
    if (chart) {
        chart.data.datasets[0].data = [0, 0];
        chart.update('none');
    }
}

/* ——— internal ——— */
function updateChart() {
    if (!chart) return;
    const { tally } = get();
    chart.data.datasets[0].data = [tally.yes, tally.no];
    chart.update('none');
}
